import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

const ROLE_RANK: Record<string, number> = { member: 0, admin: 1, owner: 2 };

export function requireRole(minRole: "admin" | "owner") {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const role = _req.user?.role ?? "member";
    if ((ROLE_RANK[role] ?? 0) < (ROLE_RANK[minRole] ?? 0)) {
      throw new AppError(403, `Requires ${minRole} role or higher`);
    }
    next();
  };
}
