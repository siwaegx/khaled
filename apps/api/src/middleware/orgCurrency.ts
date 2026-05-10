import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

export async function attachOrgCurrency(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const orgId = req.user?.orgId;
    if (orgId) {
      const rows = await prisma.$queryRaw<{ currency: string }[]>`
        SELECT currency FROM organizations WHERE id = ${orgId}
      `;
      req.orgCurrency = rows[0]?.currency ?? "USD";
    } else {
      req.orgCurrency = "USD";
    }
  } catch {
    req.orgCurrency = "USD";
  }
  next();
}
