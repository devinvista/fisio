import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable must be set in production.");
  } else {
    console.warn(
      "[auth] WARNING: JWT_SECRET is not set. Using insecure default. Set JWT_SECRET in production."
    );
  }
}

const secret = JWT_SECRET || "fisiogest-dev-secret-key-do-not-use-in-production";

export interface AuthRequest extends Request {
  userId?: number;
  userRoles?: Role[];
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", message: "No token provided" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, secret) as { userId: number; roles: Role[] };
    req.userId = payload.userId;
    req.userRoles = payload.roles ?? [];
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
  }
}

export function generateToken(userId: number, roles: Role[]): string {
  return jwt.sign({ userId, roles }, secret, { expiresIn: "7d" });
}
