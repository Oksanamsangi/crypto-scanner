import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.middleware.js";

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
