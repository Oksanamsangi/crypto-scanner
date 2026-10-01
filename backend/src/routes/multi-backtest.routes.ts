
import { Router } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { subscriptionMiddleware } from "../middleware/subscription.middleware.js";
import { requirePro } from "../middleware/pro.middleware.js";
import type { Response } from "express";

import { BinanceService } from "../services/binance.service.js";
import { MultiBacktestService } from "../services/multi-backtest.service.js";
import type { KlineInterval } from "../types/market.js";

const router = Router();

const binanceService = new BinanceService();
const multiBacktestService = new MultiBacktestService();

const DEFAULT_INTERVAL: KlineInterval = "1h";
const DEFAULT_LIMIT = 1000;

const DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
];

const DEFAULT_HORIZONS = [1, 3, 6, 12];

const DEFAULT_CONFIDENCE_LEVELS = [
  70,
  80,
  85,
  90,
  95,
];

router.get(
  "/multi-backtest",
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    try {
      const interval =
        typeof req.query.interval === "string"
          ? req.query.interval
          : DEFAULT_INTERVAL;

      const limit =
        typeof req.query.limit === "string"
          ? Number(req.query.limit)
          : DEFAULT_LIMIT;

      if (!Number.isInteger(limit) || limit < 60 || limit > 1000) {
        res.status(400).json({
          error: "limit must be an integer between 60 and 1000",
        });
        return;
      }

      const klinesBySymbol = new Map();

      for (const symbol of DEFAULT_SYMBOLS) {
        const klines = await binanceService.getKlines(
          symbol,
          interval as KlineInterval,
          limit,
        );

        klinesBySymbol.set(symbol, klines);
      }

      const result = multiBacktestService.run(
        klinesBySymbol,
        interval,
        DEFAULT_HORIZONS,
        DEFAULT_CONFIDENCE_LEVELS,
      );

      res.status(200).json(result);
    } catch (error) {
      console.error("Multi-backtest error:", error);

      res.status(500).json({
        error: "Failed to run multi-backtest",
      });
    }
  },
);

export default router;
;
