import type { Request } from "express";

export async function logActivity(
  req: Request,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
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
