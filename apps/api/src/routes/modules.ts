import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getAllManifests } from "@business360/engine";
import { installModule, uninstallModule } from "../engine/module_installer";
import type { PlanTier } from "../engine/types";
import { cacheGet, cacheSet, cacheDel } from "../lib/cache";

// Per-org limiter: 20 installs per hour (prevents install-loop DoS)
const moduleInstallLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 20,
  keyGenerator: (req) => (req as { user?: { orgId?: string } }).user?.orgId ?? req.ip ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many module installs, please try again later" },
  skip: () => process.env.NODE_ENV !== "production",
});

export const modulesRouter = Router();
modulesRouter.use(requireAuth);

// GET /api/modules — all modules enriched with install/available state for current org
modulesRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    const cacheKey = orgId ? `modules:${orgId}` : null;

    if (cacheKey) {
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);
    }

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

    const payload = { modules };
    if (cacheKey) await cacheSet(cacheKey, payload, 30); // 30s TTL
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

// POST /api/modules/install
modulesRouter.post("/install", moduleInstallLimiter, async (req, res, next) => {
  try {
    const { moduleKey } = z.object({ moduleKey: z.string().min(1) }).parse(req.body);
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No organization in session");

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    if (!org) throw new AppError(404, "Organization not found");

    await installModule(orgId, moduleKey, org.plan as PlanTier);
    await cacheDel(`modules:${orgId}`);

    const result = await prisma.installedModule.findUnique({
      where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
    });

    res.status(201).json({ installedModule: result });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
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
    await cacheDel(`modules:${orgId}`);

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
    await cacheDel(`modules:${orgId}`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});
