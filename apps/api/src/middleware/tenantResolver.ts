import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { getTenantClient } from "../lib/tenantDb";
import { AppError } from "./errorHandler";
import { cacheGet, cacheSet } from "../lib/cache";

export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user?.orgId) throw new AppError(400, "No organization in session");

    const ck = `org:tenant:${req.user.orgId}`;
    let org = await cacheGet<{ dbUrl: string | null; status: string }>(ck);

    if (!org) {
      org = await prisma.organization.findUnique({
        where: { id: req.user.orgId },
        select: { dbUrl: true, status: true },
      });
      if (org) await cacheSet(ck, org, 120); // 2 minute TTL
    }

    if (!org) throw new AppError(404, "Organization not found");
    if (org.status === "suspended") throw new AppError(403, "Organization is suspended");
    if (!org.dbUrl) throw new AppError(503, "Tenant database not yet provisioned");

    req.tenantDb = getTenantClient(org.dbUrl);
    next();
  } catch (err) {
    next(err);
  }
}
