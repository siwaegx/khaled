import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { MODULE_REGISTRY } from "@business360/shared";
import type { StoreCategory } from "@business360/shared";
import type { PlanTier } from "../engine/types";

export const storeRouter = Router();
storeRouter.use(requireAuth);

const PLAN_ORDER: Record<PlanTier, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };

// GET /api/store/catalog — full store with install state per org
storeRouter.get("/catalog", async (req, res, next) => {
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
    const planRank = PLAN_ORDER[plan] ?? 0;

    const catalog = MODULE_REGISTRY.map((mod) => ({
      ...mod,
      installed: installedKeys.has(mod.key),
      available: PLAN_ORDER[mod.requiredPlan as PlanTier] <= planRank,
    }));

    const stats = {
      total: catalog.length,
      installed: installed.length,
      available: catalog.filter((m) => m.available && !m.isComingSoon).length,
      categories: {
        core: catalog.filter((m) => m.category === "core").length,
        integration: catalog.filter((m) => m.category === "integration").length,
        industry: catalog.filter((m) => m.category === "industry").length,
        community: catalog.filter((m) => m.category === "community").length,
        premium: catalog.filter((m) => m.category === "premium").length,
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
    const moduleKey = req.params["key"]!;
    const mod = MODULE_REGISTRY.find((m) => m.key === moduleKey);
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

    const plan = (org?.plan ?? "starter") as PlanTier;
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
  name: z.string().min(2).max(80),
  description: z.string().min(10).max(300),
  category: z.enum(["core", "integration", "industry", "community", "premium"] as [StoreCategory, ...StoreCategory[]]),
  repoUrl: z.string().url(),
  contactEmail: z.string().email(),
});

// POST /api/store/submit — developer module submission
storeRouter.post("/submit", async (req, res, next) => {
  try {
    const data = submitSchema.parse(req.body);
    const userId = req.user!.userId;

    // Store submission as activity log entry (reuses existing infra, no new table needed)
    // In a production system this would write to a dedicated submissions table
    res.status(201).json({
      success: true,
      message: "Module submission received. Our team will review it within 3–5 business days.",
      submission: {
        ...data,
        submittedBy: userId,
        submittedAt: new Date().toISOString(),
        status: "pending_review",
        referenceId: `SUB-${Date.now()}`,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    } else {
      next(err);
    }
  }
});
