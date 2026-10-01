import type { Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";
import type { AuthRequest } from "./auth.middleware.js";

export async function subscriptionMiddleware(
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
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (
      user.subscriptionPlan === "PRO" &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt < new Date()
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

      req.subscriptionPlan = "FREE";
      req.subscriptionStatus = "EXPIRED";

      return next();
    }

    req.subscriptionPlan = user.subscriptionPlan;
    req.subscriptionStatus = user.subscriptionStatus;

    return next();
  } catch (error) {
    console.error("Subscription middleware error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export function requirePro(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.subscriptionPlan !== "PRO") {
    return res.status(403).json({
      error: "This feature requires a PRO subscription.",
      code: "PRO_REQUIRED",
      plan: "FREE",
    });
  }

  return next();
}
