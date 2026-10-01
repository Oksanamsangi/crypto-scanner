
import { Router } from "express";

import {
  getMarketSnapshot,
} from "./marketData.js";

import {
  analyzeMarketRegime,
} from "../services/market-regime.service.js";

const router = Router();

router.get(
  "/snapshot",
  async (req, res) => {
    try {
      const symbol =
        typeof req.query.symbol === "string"
          ? req.query.symbol.toUpperCase()
          : "BTCUSDT";

      const interval =
        typeof req.query.interval === "string"
          ? req.query.interval
          : "1h";

      const snapshot =
        await getMarketSnapshot(
          symbol,
          interval,
        );

      const regime =
        analyzeMarketRegime(snapshot);

      res.json({
        success: true,

        data: {
          ...snapshot,

          intelligence: {
            regime,
          },
        },
      });
    } catch (error) {
      console.error(
        "Intelligence snapshot error:",
        error,
      );

      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate market snapshot.",
      });
    }
  },
);

export default router;
