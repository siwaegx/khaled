import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";
import { getManifest, planIncludes } from "@business360/engine";
import type { Plan } from "@business360/engine";
import { ROLE_RANK } from "./requireRole";

// Default module access for specialized roles when no explicit moduleAccess config exists.
// A specialized role is granted read access (GETs) to their natural domain module by default.
const DEFAULT_ROLE_MODULE_ACCESS: Record<string, string[]> = {
  sales_leader:      ["crm", "contacts", "reports"],
  inventory_manager: ["inventory", "reports"],
  accountant:        ["accounting", "reports"],
  engineer:          ["projects", "reports"],
  service_agent:     ["crm", "contacts", "reports"],
};

export function requireModule(moduleKey: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgId  = req.user?.orgId;
      const userId = req.user?.userId;
      const role   = req.user?.role ?? "member";
      if (!orgId) throw new AppError(403, "No organization in session");

      // Step 1: check the module is installed (auto-install if plan allows).
      // Fetch org once — we need plan + moduleAccess in one round-trip.
      const [installed, org] = await Promise.all([
        prisma.installedModule.findUnique({
          where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
        }),
        prisma.organization.findUnique({
          where: { id: orgId },
          select: { plan: true, moduleAccess: true },
        }),
      ]);

      let isInstalled = installed?.isActive ?? false;
      if (!isInstalled) {
        const manifest = getManifest(moduleKey);
        if (org && manifest && planIncludes(org.plan as Plan, manifest.requiredPlan)) {
          await prisma.installedModule.upsert({
            where:  { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
            create: { organizationId: orgId, moduleKey, isActive: true },
            update: { isActive: true },
          });
          isInstalled = true;
        }
      }
      if (!isInstalled) throw new AppError(403, `Module "${moduleKey}" is not installed`);

      // Step 2: Owners and managers always have full access.
      if ((ROLE_RANK[role] ?? 0) >= ROLE_RANK["manager"]!) return next();

      // Step 3: Check the role×module access matrix configured by the owner.
      const accessMap = (org?.moduleAccess as Record<string, Record<string, boolean>> | null) ?? {};
      if (accessMap[moduleKey]?.[role] === true) return next();

      // Step 3b: Default access for specialized roles (no explicit config required).
      const defaultModules = DEFAULT_ROLE_MODULE_ACCESS[role] ?? [];
      if (defaultModules.includes(moduleKey)) return next();

      // Step 4: Team membership as extension.
      const membership = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: userId!, organizationId: orgId } },
        select: { id: true },
      });
      if (membership) {
        const teamAccess = await prisma.orgTeamMember.findFirst({
          where: { memberId: membership.id, team: { organizationId: orgId, moduleKey } },
        });
        if (teamAccess) return next();
      }

      throw new AppError(403, `You do not have access to the "${moduleKey}" module.`);
    } catch (err) {
      next(err);
    }
  };
}
