import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types";
import { AppError } from "./errorHandler";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies["access_token"] as string | undefined;
  if (!token) throw new AppError(401, "Unauthorized");

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "secret") as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
}
