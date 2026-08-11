import { Router } from "express";
import type { Request, Response } from "express";

import { SignalHistoryService } from "../services/signal-history.service.js";

const router = Router();

export const signalHistoryService = new SignalHistoryService();

router.get("/", (req: Request, res: Response) => {
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
      : 100;

  const limit =
    Number.isInteger(requestedLimit) &&
    requestedLimit >= 1 &&
    requestedLimit <= 500
      ? requestedLimit
      : 100;

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
  });
});

router.get("/stats", (_req: Request, res: Response) => {
  res.json(signalHistoryService.getStats());
});

router.delete("/", (_req: Request, res: Response) => {
  signalHistoryService.clear();

  res.json({
    status: "ok",
    message: "Signal history cleared.",
  });
});

export default router;