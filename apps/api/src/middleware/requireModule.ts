import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

export function requireModule(moduleKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) throw new AppError(403, "No organization in session");

      const installed = await prisma.installedModule.findUnique({
        where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
      });
      if (!installed?.isActive) {
        throw new AppError(403, `Module "${moduleKey}" is not installed`);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
