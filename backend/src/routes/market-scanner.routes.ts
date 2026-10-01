import { Router } from "express";
import type { Response } from "express";
import { authMiddleware, type AuthRequest } from "../middleware/auth.middleware.js";
import { subscriptionMiddleware, requirePro } from "../middleware/subscription.middleware.js";

import { MarketScannerService } from "../services/market-scanner.service.js";
import type { KlineInterval } from "../types/market.js";

const router = Router();

const marketScannerService = new MarketScannerService();

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

const DEFAULT_INTERVAL: KlineInterval = "1h";
const DEFAULT_LIMIT = 100;

function isValidInterval(value: string): value is KlineInterval {
  return (VALID_INTERVALS as readonly string[]).includes(value);
}

router.get(
  "/",
  authMiddleware,
  subscriptionMiddleware,
  requirePro,
  async (req: AuthRequest, res: Response) => {
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

  if (!Number.isInteger(limitParam) || limitParam < 60 || limitParam > 1000) {
    res.status(400).json({
      error: "Invalid limit. Must be an integer between 60 and 1000",
    });

    return;
  }

  try {
    const result = await marketScannerService.scanMarket(
      intervalParam,
      limitParam,
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Market scanner error:", error);

    res.status(500).json({
      error: "Market scanner failed",
    });
  }
  },
);

export default router;
