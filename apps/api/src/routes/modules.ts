import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getAllManifests } from "@business360/engine";
import { installModule, uninstallModule } from "../engine/module_installer";
import type { PlanTier } from "../engine/types";

export const modulesRouter = Router();
modulesRouter.use(requireAuth);

// GET /api/modules — all modules enriched with install/available state for current org
modulesRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;

    const [installed, org] = await Promise.all([
      orgId
        ? prisma.installedModule.findMany({
            where: { organizationId: orgId, isActive: true },
            select: { moduleKey: true },
          })
        : Promise.resolve([]),
      orgId
        ? prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } })
        : Promise.resolve(null),
    ]);

    const installedKeys = new Set(installed.map((m) => m.moduleKey));
    const plan = (org?.plan ?? "starter") as PlanTier;

    const PLAN_ORDER: Record<PlanTier, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };
    const planRank = PLAN_ORDER[plan];

    const modules = getAllManifests().map((m) => ({
      ...m,
      installed: installedKeys.has(m.key),
      available: planRank >= (PLAN_ORDER[m.requiredPlan as PlanTier] ?? 0),
    }));

    res.json({ modules });
  } catch (err) {
    next(err);
  }
});

// POST /api/modules/install
modulesRouter.post("/install", async (req, res, next) => {
  try {
    const { moduleKey } = z.object({ moduleKey: z.string().min(1) }).parse(req.body);
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No organization in session");

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    if (!org) throw new AppError(404, "Organization not found");

    await installModule(orgId, moduleKey, org.plan as PlanTier);

    const result = await prisma.installedModule.findUnique({
      where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
    });

    res.status(201).json({ installedModule: result });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// PATCH /api/modules/:key/toggle — enable / disable without uninstalling
modulesRouter.patch("/:key/toggle", async (req, res, next) => {
  try {
    const moduleKey = req.params["key"]!;
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No organization in session");

    const existing = await prisma.installedModule.findUnique({
      where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
    });
    if (!existing) throw new AppError(404, "Module not installed");

    const updated = await prisma.installedModule.update({
      where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
      data: { isActive: !existing.isActive },
    });

    res.json({ installedModule: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/modules/:key — uninstall
modulesRouter.delete("/:key", async (req, res, next) => {
  try {
    const moduleKey = req.params["key"]!;
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No organization in session");

    await uninstallModule(orgId, moduleKey);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
