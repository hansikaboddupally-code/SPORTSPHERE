import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.sportsphere_token;
  if (!token) {
    res.status(401).json({ message: "Please sign in to continue." });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;
    if (typeof payload.sub !== "string" || (payload.role !== "customer" && payload.role !== "admin")) {
      res.status(401).json({ message: "Your session is invalid. Please sign in again." });
      return;
    }
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "Administrator access is required." });
    return;
  }
  next();
}
