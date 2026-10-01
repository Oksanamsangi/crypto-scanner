import { Router } from "express";
import type { Response } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { subscriptionMiddleware } from "../middleware/subscription.middleware.js";
import { scannerLimitMiddleware } from "../middleware/scanner-limit.middleware.js";
import { signalHistoryService } from "./signal-history.routes.js";
import prisma from "../lib/prisma.js";
import {
  BinanceService,
  BinanceServiceError,
} from "../services/binance.service.js";

import { ScannerService } from "../services/scanner.service.js";
import { analyzeMarket } from "../services/market-intelligence.service.js";
import {
  analyzeCrossMarket,
} from "../services/cross-market-confirmation.service.js";

import {
  buildMarketOpinion,
} from "../services/market-opinion.service.js";

import {
  analyzeMarketRegime,
} from "../services/market-regime.service.js";

import {
  regimeTransitionService,
} from "../services/regime-transition.service.js";

import type { KlineInterval, Ticker24h } from "../types/market.js";
import {
  ContextAwareSignalService,
} from "../services/context-aware-signal.service.js";

import {
  getMarketSnapshot,
} from "../intellegence/marketData.js";

import {
  buildContextIntelligence,
} from "../services/context-intelligence-adapter.service.js";
import { evaluateDecision } from "../services/decision-engine.service.js";

const router = Router();

const binanceService = new BinanceService();
const scannerService = new ScannerService();
const contextAwareSignalService =
  new ContextAwareSignalService();


const VALID_INTERVALS: readonly KlineInterval[] = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
];

const FREE_INTERVAL: KlineInterval = "1h";
const DEFAULT_INTERVAL: KlineInterval = "1h";
const DEFAULT_LIMIT = 100;

const MIN_LIMIT = 60;
const MAX_LIMIT = 1000;

const FREE_MAX_PAIRS = 10;

const CONCURRENCY = 5;

const MIN_QUOTE_VOLUME = 1_000_000;

const EXCLUDED_SYMBOLS = new Set([
  "USDCUSDT",
  "FDUSDUSDT",
  "USD1USDT",
  "TUSDUSDT",
  "EURIUSDT",
  "DAIUSDT",
]);

const EXCLUDED_BASE_ASSETS = new Set([
  "EUR",
  "XUSD",
  "BFUSD",
  "USDE",
  "U",
  "RLUSD",
]);

function isValidInterval(value: string): value is KlineInterval {
  return (VALID_INTERVALS as readonly string[]).includes(value);
}

function handleRouteError(error: unknown, res: Response): void {
  if (error instanceof BinanceServiceError) {
    const status =
      error.status !== undefined && error.status >= 400 && error.status < 600
        ? error.status
        : 502;

    res.status(status).json({
      error: error.message,
    });

    return;
  }

  res.status(500).json({
    error: "Internal server error",
  });
}

async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let index = 0;

  async function runner(): Promise<void> {
    while (true) {
      const currentIndex = index++;

      if (currentIndex >= items.length) {
        return;
      }

      const item = items[currentIndex];

      if (item === undefined) {
        return;
      }

      await worker(item);
    }
  }

  const workers = Array.from(
    {
      length: Math.min(concurrency, items.length),
    },
    () => runner(),
  );

  await Promise.all(workers);
}

router.get(
  "/",
  authMiddleware,
  subscriptionMiddleware,
  scannerLimitMiddleware,
  async (req: AuthRequest, res: Response) => {
    if (!req.userId) {
      res.status(401).json({
        error: "Authentication required",
      });

      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
      },
    });

    if (!user) {
      res.status(401).json({
        error: "User not found",
      });

      return;
    }

    const now = new Date();

    if (
      user.subscriptionPlan === "PRO" &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt <= now
    ) {
      await prisma.user.update({
        where: {
          id: req.userId,
        },
        data: {
          subscriptionPlan: "FREE",
          subscriptionStatus: "EXPIRED",
          subscriptionExpiresAt: null,
        },
      });

      user.subscriptionPlan = "FREE";
      user.subscriptionStatus = "EXPIRED";
      user.subscriptionExpiresAt = null;
    }

    const isPro =
      user.subscriptionPlan === "PRO" &&
      user.subscriptionStatus === "ACTIVE" &&
      (!user.subscriptionExpiresAt ||
        user.subscriptionExpiresAt > now);

    const intervalParam =
      typeof req.query.interval === "string"
        ? req.query.interval
        : DEFAULT_INTERVAL;

    if (!isValidInterval(intervalParam)) {
      res.status(400).json({
        error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(", ")}`,
      });

      return;
    }

    if (!isPro && intervalParam !== FREE_INTERVAL) {
      res.status(403).json({
        error: "This timeframe is available only on the PRO plan.",
        code: "PRO_REQUIRED",
        plan: "FREE",
        allowedInterval: FREE_INTERVAL,
      });

      return;
    }

    const limitParam =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : DEFAULT_LIMIT;

    if (
      !Number.isInteger(limitParam) ||
      limitParam < MIN_LIMIT ||
      limitParam > MAX_LIMIT
    ) {
      res.status(400).json({
        error: `Invalid limit. Must be an integer between ${MIN_LIMIT} and ${MAX_LIMIT}`,
      });

      return;
    }

    try {
      const [tickers, exchangeInfo] = await Promise.all([
        binanceService.getAll24hTickers(),
        binanceService.getExchangeInfo(),
      ]);

      const tradableUsdtSymbols = new Set(
        exchangeInfo.symbols
          .filter(
            (symbol) =>
              symbol.quoteAsset === "USDT" &&
              symbol.status === "TRADING" &&
              !symbol.baseAsset.endsWith("B") &&
              !EXCLUDED_BASE_ASSETS.has(symbol.baseAsset),
          )
          .map((symbol) => symbol.symbol),
      );

      let eligibleTickers = tickers
        .filter(
          (ticker: Ticker24h) =>
            tradableUsdtSymbols.has(ticker.symbol) &&
            !EXCLUDED_SYMBOLS.has(ticker.symbol) &&
            ticker.quoteVolume >= MIN_QUOTE_VOLUME,
        )
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      if (!isPro) {
        eligibleTickers = eligibleTickers.slice(0, FREE_MAX_PAIRS);
      }

      const results: ReturnType<ScannerService["scan"]>[] = [];

    const tickersToScan = isPro
      ? eligibleTickers
      : eligibleTickers.slice(0, 5);

      await runWithConcurrency(
        tickersToScan,
        async (ticker) => {
          try {
            const klines = await binanceService.getKlines(
              ticker.symbol,
              intervalParam,
              limitParam,
            );

            const result = scannerService.scan(
              ticker.symbol,
              intervalParam,
              klines,
            );

            results.push(result);
          } catch {
            return;
          }
        },
        CONCURRENCY,
      );

      results.sort((a, b) => b.score - a.score);

      signalHistoryService.addSignals(results);

    const intelligence =
  analyzeMarket(results);

const crossMarket =
  await analyzeCrossMarket(
    results,
    intervalParam,
  );

const marketSnapshot =
  await getMarketSnapshot(
    "BTCUSDT",
    intervalParam,
  );

const marketRegime =
  analyzeMarketRegime(
    marketSnapshot,
  );

const transition =
  regimeTransitionService.analyze(
    `scanner:BTCUSDT:${intervalParam}`,
    marketRegime,
  );

const marketOpinion =
  buildMarketOpinion(
    intelligence,
    marketRegime,
    crossMarket,
    transition,
  );

const contextResults =
  await Promise.all(
    results.map(async (result) => {
      try {
        if (
          result.signal === "NEUTRAL"
        ) {
          return {
            ...result,
            context: null,
            decision: null,
          };
        }

        const snapshot =
          await getMarketSnapshot(
            result.symbol,
            intervalParam,
          );

        const contextIntelligence =
          buildContextIntelligence(
            result,
            snapshot,
          );

        const contextResult =
          contextAwareSignalService.analyze(
            {
              signal: result.signal,
              confidence: result.confidence,
              signalStrength:
                result.signalStrength,
              score: result.score,
            },
            contextIntelligence,
          );

        const decisionResult =
          evaluateDecision(
            contextResult,
            result.riskRewardRatio,
          );

        return {
          ...result,

          context: contextResult,
          decision: decisionResult,
        };
      } catch (error) {
        console.error(
          `Context analysis failed for ${result.symbol}:`,
          error,
        );

        return {
          ...result,
          context: null,
          decision: null,
        };
      }
    }),
  );

const topBuy =
  contextResults
    .filter(
      (result) =>
        result.context?.finalSignal ===
        "BUY",
    )
    .sort(
      (a, b) =>
        (b.decision?.decisionScore ?? 0) -
        (a.decision?.decisionScore ?? 0),
    )
    .slice(0, 10);

const topSell =
  contextResults
    .filter(
      (result) =>
        result.context?.finalSignal ===
        "SELL",
    )
    .sort(
      (a, b) =>
        (b.decision?.decisionScore ?? 0) -
        (a.decision?.decisionScore ?? 0),
    )
    .slice(0, 10);

   res.status(200).json({
  interval: intervalParam,
  candles: limitParam,
  plan: isPro ? "PRO" : "FREE",
  scannedPairs: contextResults.length,
  topBuy,
  topSell,
  intelligence,
  crossMarket,
  marketOpinion,
  results: contextResults,
});
    } catch (error) {
      handleRouteError(error, res);
    }
  },
);

export default router;