import type { Request, Response, NextFunction } from "express";

/** Convert a Prisma Decimal or plain number to a JS number. Use for financial arithmetic. */
export function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  // Prisma.Decimal has .toNumber()
  if (typeof (v as { toNumber?: () => number }).toNumber === "function") {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

export type HookEvent =
  | "lead.created"   | "lead.updated"   | "lead.deleted"
  | "deal.created"   | "deal.updated"
  | "invoice.created"| "invoice.updated"
  | "member.invited" | "member.joined"
  | "task.created"   | "task.updated"
  | "calendar.created";

export interface HookService {
  fire(event: HookEvent, payload: Record<string, unknown>): Promise<void>;
}

// Extend Express.Request to add hookService — user and tenantDb are declared by the API app
declare global {
  namespace Express {
    interface Request {
      hookService?: HookService;
    }
  }
}

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AppError";
  }
}

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
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role ?? "member";
    if ((ROLE_RANK[role] ?? 0) < (ROLE_RANK[minRole] ?? 0)) {
      throw new AppError(403, `Requires ${minRole} role or higher`);
    }
    next();
  };
}

export async function fireHook(
  req: Request,
  event: HookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!req.hookService) return;
  await req.hookService.fire(event, payload).catch(() => {}); // best-effort
}

export async function logActivity(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  const db = req.tenantDb as Record<string, { create: (args: unknown) => Promise<unknown> }> | undefined;
  if (!db?.activityLog) return;
  await db.activityLog.create({
    data: {
      userId: req.user?.userId ?? "system",
      action,
      entity,
      entityId: entityId ?? null,
      meta: meta ?? null,
    },
  });
}
