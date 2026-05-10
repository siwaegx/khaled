import type { Request, Response, NextFunction } from "express";
import { AppError } from "./errorHandler";

// Rank 0 = least privileged, 3 = most privileged.
// Specialized roles (rank 1) lead their domain teams but cannot do org-wide management.
// Org-wide management (invites, teams, API keys) requires manager (rank 2) or owner (rank 3).
const ROLE_RANK: Record<string, number> = {
  member:            0,
  sales_leader:      1,
  inventory_manager: 1,
  accountant:        1,
  engineer:          1,
  service_agent:     1,
  manager:           2,
  owner:             3,
};

export function requireRole(minRole: "manager" | "owner") {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    const role = _req.user?.role ?? "member";
    if ((ROLE_RANK[role] ?? 0) < (ROLE_RANK[minRole] ?? 0)) {
      throw new AppError(403, `Requires ${minRole} role or higher`);
    }
    next();
  };
}

export { ROLE_RANK };
