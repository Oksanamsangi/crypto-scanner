import { Router } from "express";
import type { Response } from "express";

import prisma from "../lib/prisma.js";
import {
  authMiddleware,
  type AuthRequest,
} from "../middleware/auth.middleware.js";
import { activateTrial } from "../services/subscription.service.js";

const router = Router();

const TRIAL_PRICE = 1.99;
const TRIAL_DAYS = 3;

router.post(
  "/trial",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          error: "Authentication required",
        });
      }

      const result = await activateTrial(req.userId);

      return res.json({
        status: "ok",
        message: "3-day PRO access activated.",
        ...result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return res.status(404).json({
          error: "User not found",
        });
      }

      if (error instanceof Error && error.message === "ACTIVE_PRO") {
        return res.status(400).json({
          error: "User already has an active PRO subscription.",
        });
      }

      console.error("Subscription trial error:", error);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  },
);

export default router;
