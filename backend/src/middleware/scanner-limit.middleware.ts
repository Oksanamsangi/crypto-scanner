import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";
import prisma from "../lib/prisma.js";

const FREE_DAILY_LIMIT = 10;

export async function scannerLimitMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.userId) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (req.subscriptionPlan === "PRO") {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: {
        id: req.userId,
      },
      select: {
        dailyScanCount: true,
        dailyScanDate: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const storedDate = user.dailyScanDate
      ? user.dailyScanDate.toISOString().slice(0, 10)
      : null;

    if (storedDate !== today) {
      await prisma.user.update({
        where: {
          id: req.userId,
        },
        data: {
          dailyScanCount: 1,
          dailyScanDate: now,
        },
      });

      return next();
    }

    if (user.dailyScanCount >= FREE_DAILY_LIMIT) {
      return res.status(429).json({
        error: "Daily free scan limit reached",
        code: "FREE_SCAN_LIMIT_REACHED",
        limit: FREE_DAILY_LIMIT,
        plan: "FREE",
      });
    }

    await prisma.user.update({
      where: {
        id: req.userId,
      },
      data: {
        dailyScanCount: {
          increment: 1,
        },
      },
    });

    return next();
  } catch (error) {
    console.error("Scanner limit middleware error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
