import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { getAllManifests } from "@business360/engine";
import type { StoreCategory } from "@business360/engine";
import type { PlanTier } from "../engine/types";
import { bootstrapModules } from "../bootstrap/registerModules";

export const storeRouter = Router();
storeRouter.use(requireAuth);

const PLAN_ORDER: Record<PlanTier, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };

// GET /api/store/catalog — full catalog auto-discovered from /modules/
// Re-scans /modules/ on every call so adding or deleting a module folder is
// reflected immediately without restarting the server.
storeRouter.get("/catalog", async (req, res, next) => {
  try {
    bootstrapModules();           // refresh manifest registry from disk
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
    const plan          = (org?.plan ?? "starter") as PlanTier;
    const planRank      = PLAN_ORDER[plan] ?? 0;

    const catalog = getAllManifests().map((mod) => ({
      ...mod,
      installed: installedKeys.has(mod.key),
      available: PLAN_ORDER[mod.requiredPlan as PlanTier] <= planRank,
    }));

    const stats = {
      total:     catalog.length,
      installed: installed.length,
      available: catalog.filter((m) => m.available && !m.isComingSoon).length,
      categories: {
        core:        catalog.filter((m) => m.category === "core").length,
        integration: catalog.filter((m) => m.category === "integration").length,
        industry:    catalog.filter((m) => m.category === "industry").length,
        community:   catalog.filter((m) => m.category === "community").length,
        premium:     catalog.filter((m) => m.category === "premium").length,
      },
    };

    res.json({ catalog, stats, plan });
  } catch (err) {
    next(err);
  }
});

// GET /api/store/catalog/:key — single module detail
storeRouter.get("/catalog/:key", async (req, res, next) => {
  try {
    bootstrapModules();           // refresh so deleted modules return 404 immediately
    const moduleKey = req.params["key"]!;
    const mod       = getAllManifests().find((m) => m.key === moduleKey);
    if (!mod) throw new AppError(404, `Module "${moduleKey}" not found in store`);

    const orgId = req.user!.orgId;
    const [installed, org] = await Promise.all([
      orgId
        ? prisma.installedModule.findUnique({
            where: { organizationId_moduleKey: { organizationId: orgId, moduleKey } },
          })
        : Promise.resolve(null),
      orgId
        ? prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } })
        : Promise.resolve(null),
    ]);

    const plan     = (org?.plan ?? "starter") as PlanTier;
    const planRank = PLAN_ORDER[plan] ?? 0;

    res.json({
      module: {
        ...mod,
        installed: !!(installed?.isActive),
        available: PLAN_ORDER[mod.requiredPlan as PlanTier] <= planRank,
      },
    });
  } catch (err) {
    next(err);
  }
});

const submitSchema = z.object({
  name:         z.string().min(2).max(80),
  description:  z.string().min(10).max(300),
  category:     z.enum(["core", "integration", "industry", "community", "premium"] as [StoreCategory, ...StoreCategory[]]),
  repoUrl:      z.string().url(),
  contactEmail: z.string().email(),
});

// POST /api/store/submit — legacy endpoint (redirects to developer portal)
storeRouter.post("/submit", async (_req, res) => {
  void submitSchema; // keep import alive
  res.status(301).json({
    error: "Use the Developer Portal at /dashboard/store/developer to submit modules.",
    redirectTo: "/dashboard/store/developer",
  });
});

// GET /api/store/marketplace — approved community marketplace modules
storeRouter.get("/marketplace", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;

    const [modules, installed] = await Promise.all([
      prisma.marketplaceModule.findMany({
        where:   { isActive: true },
        orderBy: { installCount: "desc" },
      }),
      orgId
        ? prisma.installedModule.findMany({
            where:  { organizationId: orgId, isActive: true },
            select: { moduleKey: true },
          })
        : Promise.resolve([]),
    ]);

    const installedKeys = new Set(installed.map((m) => m.moduleKey));
    const enriched      = modules.map((mod) => ({
      ...mod,
      installed: installedKeys.has(mod.key),
    }));

    res.json({ modules: enriched });
  } catch (err) {
    next(err);
  }
});
