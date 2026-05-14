import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

export function requireSaasAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isAdmin) {
    return next(new AppError(403, "SaaS platform admin access required"));
  }
  next();
}
