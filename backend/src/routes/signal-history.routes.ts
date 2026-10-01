import { Router } from "express";
import type { Response } from "express";

import {
  authMiddleware,
  type AuthRequest,
} from "../middleware/auth.middleware.js";

import {
  subscriptionMiddleware,
  requirePro,
} from "../middleware/subscription.middleware.js";

import { SignalHistoryService } from "../services/signal-history.service.js";

const router = Router();

export const signalHistoryService = new SignalHistoryService();

const FREE_HISTORY_LIMIT = 20;
const PRO_HISTORY_LIMIT = 500;

router.get(
  "/",
  authMiddleware,
  subscriptionMiddleware,
  (req: AuthRequest, res: Response) => {
    const symbol =
      typeof req.query.symbol === "string"
        ? req.query.symbol
        : undefined;

    const timeframe =
      typeof req.query.timeframe === "string"
        ? req.query.timeframe
        : undefined;

    const signal =
      req.query.signal === "BUY" || req.query.signal === "SELL"
        ? req.query.signal
        : undefined;

    const requestedLimit =
      typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : undefined;

    const maxLimit =
      req.subscriptionPlan === "PRO"
        ? PRO_HISTORY_LIMIT
        : FREE_HISTORY_LIMIT;

    const limit =
      requestedLimit !== undefined &&
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1
        ? Math.min(requestedLimit, maxLimit)
        : Math.min(100, maxLimit);

    const historyOptions: {
      symbol?: string;
      timeframe?: string;
      signal?: "BUY" | "SELL";
      limit?: number;
    } = {
      limit,
    };

    if (symbol !== undefined) {
      historyOptions.symbol = symbol;
    }

    if (timeframe !== undefined) {
      historyOptions.timeframe = timeframe;
    }

    if (signal !== undefined) {
      historyOptions.signal = signal;
    }

    const history = signalHistoryService.getHistory(historyOptions);

    res.json({
      count: history.length,
      history,
      plan: req.subscriptionPlan,
      limit: maxLimit,
    });
  },
);

router.get(
  "/stats",
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  (_req: AuthRequest, res: Response) => {
    res.json(signalHistoryService.getStats());
  },
);

router.delete(
  "/",
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  (_req: AuthRequest, res: Response) => {
    signalHistoryService.clear();

    res.json({
      status: "ok",
      message: "Signal history cleared.",
    });
  },
);

export default router;
