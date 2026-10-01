
import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { subscriptionMiddleware } from "../middleware/subscription.middleware.js";
import { requirePro } from "../middleware/pro.middleware.js";
import type { Response } from "express";
import { BinanceService, BinanceServiceError } from "../services/binance.service.js";
import { BacktestService } from "../services/backtest.service.js";
import type { KlineInterval } from "../types/market.js";

const router = Router();

const binanceService = new BinanceService();
const backtestService = new BacktestService();

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

const MIN_LIMIT = 100;
const MAX_LIMIT = 1000;
const DEFAULT_INTERVAL: KlineInterval = "1h";
const DEFAULT_LIMIT = 1000;
const DEFAULT_HORIZON = 6;
const MAX_HORIZON = 100;

function isValidInterval(
  value: string,
): value is KlineInterval {
  return (
    VALID_INTERVALS as readonly string[]
  ).includes(value);
}

function handleRouteError(
  error: unknown,
  res: Response,
): void {
  if (error instanceof BinanceServiceError) {
    const status =
      error.status &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 502;

    res.status(status).json({
      error: error.message,
    });

    return;
  }

  if (error instanceof Error) {
    res.status(400).json({
      error: error.message,
    });

    return;
  }

  res.status(500).json({
    error: "Internal server error",
  });
}

/**
 * GET /:symbol
 *
 * Runs a historical backtest for the requested symbol.
 *
 * Query parameters:
 *
 * interval - candle interval, default "1h"
 * limit    - number of candles, default 1000
 * horizon  - number of candles into the future, default 6
 */
router.get(
  "/:symbol",
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    const { symbol } = req.params;

    if (
      typeof symbol !== "string" ||
      symbol.trim().length === 0
    ) {
      res.status(400).json({
        error: "A valid symbol is required",
      });

      return;
    }

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

    const horizonParam =
      typeof req.query.horizon === "string"
        ? Number(req.query.horizon)
        : DEFAULT_HORIZON;

    if (
      !Number.isInteger(horizonParam) ||
      horizonParam < 1 ||
      horizonParam > MAX_HORIZON
    ) {
      res.status(400).json({
        error: `Invalid horizon. Must be an integer between 1 and ${MAX_HORIZON}`,
      });

      return;
    }

    try {
      const normalizedSymbol =
        symbol.toUpperCase();

      const klines =
        await binanceService.getKlines(
          normalizedSymbol,
          intervalParam,
          limitParam,
        );

      const result =
        backtestService.run(
          normalizedSymbol,
          intervalParam,
          klines,
          horizonParam,
        );

      res.status(200).json(result);
    } catch (error) {
      handleRouteError(error, res);
    }
  },
);

export default router;

