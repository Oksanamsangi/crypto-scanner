import "dotenv/config";
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

const JWT_SECRET = () => process.env.JWT_SECRET ?? "";

export interface AuthRequest extends Request {
  userId?: string;
  subscriptionPlan?: "FREE" | "PRO";
  subscriptionStatus?: "ACTIVE" | "CANCELED" | "EXPIRED";
}

interface AuthJwtPayload extends JwtPayload {
  userId: string;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const secret = JWT_SECRET();

    if (!secret) {
      return res.status(500).json({
        error: "JWT_SECRET is not configured",
      });
    }

    const decoded = jwt.verify(token, secret) as AuthJwtPayload;

    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.userId !== "string"
    ) {
      return res.status(401).json({
        error: "Invalid token",
      });
    }

    req.userId = decoded.userId;

    next();
  } catch {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }
}
