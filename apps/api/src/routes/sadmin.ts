import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { requireAuth } from "../middleware/requireAuth";
import { requireSaasAdmin } from "../middleware/requireSaasAdmin";
import { prisma } from "../lib/prisma";
import { getTenantClient } from "../lib/tenantDb";
import { cacheDel } from "../lib/cache";
import { AppError } from "../middleware/errorHandler";
import type { JwtPayload } from "../types";

export const sadminRouter = Router();

// ── Plan config types ─────────────────────────────────────────────────────────
export type PlanFeature = { text: string; included: boolean };
export type PlanConfig = {
  key: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  memberLimit: number; // 0 = unlimited
  isPopular: boolean;
  ctaText: string;
  features: PlanFeature[];
};

export const DEFAULT_PLAN_CONFIGS: PlanConfig[] = [
  {
    key: "starter", name: "Starter", price: 29, yearlyPrice: 23, memberLimit: 3,
    isPopular: false, ctaText: "Get Started",
    description: "Perfect for small teams getting started.",
    features: [
      { text: "CRM module",         included: true  },
      { text: "Up to 3 users",      included: true  },
      { text: "1 organization",     included: true  },
      { text: "Email support",      included: true  },
      { text: "Inventory module",   included: false },
      { text: "Accounting module",  included: false },
      { text: "HR module",          included: false },
      { text: "API access",         included: false },
    ],
  },
  {
    key: "growth", name: "Growth", price: 79, yearlyPrice: 63, memberLimit: 15,
    isPopular: true, ctaText: "Get Started",
    description: "For growing businesses that need more.",
    features: [
      { text: "CRM module",         included: true  },
      { text: "Inventory module",   included: true  },
      { text: "Up to 15 users",     included: true  },
      { text: "3 organizations",    included: true  },
      { text: "Priority support",   included: true  },
      { text: "Accounting module",  included: false },
      { text: "HR module",          included: false },
      { text: "API access",         included: false },
    ],
  },
  {
    key: "pro", name: "Pro", price: 149, yearlyPrice: 119, memberLimit: 50,
    isPopular: false, ctaText: "Get Started",
    description: "All core modules for serious operations.",
    features: [
      { text: "CRM module",              included: true },
      { text: "Inventory module",        included: true },
      { text: "Accounting module",       included: true },
      { text: "HR module",               included: true },
      { text: "Up to 50 users",          included: true },
      { text: "Unlimited organizations", included: true },
      { text: "API access",              included: true },
      { text: "Priority support",        included: true },
    ],
  },
  {
    key: "enterprise", name: "Enterprise", price: 299, yearlyPrice: 239, memberLimit: 0,
    isPopular: false, ctaText: "Contact Sales",
    description: "Advanced features for large organizations.",
    features: [
      { text: "All Pro features",     included: true },
      { text: "Unlimited users",      included: true },
      { text: "Advanced modules",     included: true },
      { text: "Custom integrations",  included: true },
      { text: "Dedicated support",    included: true },
      { text: "SLA guarantee",        included: true },
      { text: "On-premise option",    included: true },
      { text: "Custom branding",      included: true },
    ],
  },
];

// Mutable platform settings — backed by a JSON file so changes survive restarts
// __dirname = apps/api/src/routes → go up 4 levels to repo root, then into data/
const PLATFORM_SETTINGS_PATH = path.resolve(__dirname, "../../../../data/platform-settings.json");

type PlatformSettings = {
  planPrices: Record<string, number>;
  trialDays: number;
  maintenanceMode: boolean;
  announcement: string;
  planConfigs: PlanConfig[];
};

function loadPlatformSettings(): PlatformSettings {
  try {
    const raw = fs.readFileSync(PLATFORM_SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as PlatformSettings;
  } catch {
    return {
      planPrices: { starter: 29, growth: 79, pro: 149, enterprise: 299 },
      trialDays: 14,
      maintenanceMode: false,
      announcement: "",
      planConfigs: JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIGS)) as PlanConfig[],
    };
  }
}

function savePlatformSettings(): void {
  try {
    fs.mkdirSync(path.dirname(PLATFORM_SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(PLATFORM_SETTINGS_PATH, JSON.stringify(platformSettings, null, 2), "utf-8");
  } catch (err) {
    console.error("[sadmin] Failed to persist platform settings:", err);
  }
}

export const platformSettings: PlatformSettings = loadPlatformSettings();

sadminRouter.use(requireAuth);
sadminRouter.use(requireSaasAdmin);

// ── GET /api/sadmin/stats ─────────────────────────────────────────────────────
sadminRouter.get("/stats", async (_req, res, next) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalOrgs, totalUsers, orgsByPlan, orgsByStatus, newOrgsWeek, newUsersWeek] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.organization.groupBy({ by: ["plan"], _count: { id: true } }),
      prisma.organization.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.organization.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);
    res.json({ totalOrgs, totalUsers, orgsByPlan, orgsByStatus, newOrgsWeek, newUsersWeek });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/alerts ────────────────────────────────────────────────────
sadminRouter.get("/alerts", async (_req, res, next) => {
  try {
    const now     = new Date();
    const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [trialsExpiring, pendingSubmissions, newOrgsWeek, newUsersWeek, recentCancellations] = await Promise.all([
      prisma.organization.findMany({
        where: { status: "trial", trialEnds: { lte: in7days, gte: now } },
        select: { id: true, name: true, slug: true, plan: true, trialEnds: true, _count: { select: { members: true } } },
        orderBy: { trialEnds: "asc" },
      }),
      prisma.moduleSubmission.count({ where: { status: "pending" } }),
      prisma.organization.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.organization.findMany({
        where: { status: "cancelled", updatedAt: { gte: weekAgo } },
        select: { id: true, name: true, plan: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    res.json({ trialsExpiring, pendingSubmissions, newOrgsWeek, newUsersWeek, recentCancellations });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/organizations ─────────────────────────────────────────────
sadminRouter.get("/organizations", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "25"))));
    const skip   = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();
    const status = String(req.query["status"] ?? "").trim();

    const where: Record<string, unknown> = {};
    if (search) where["OR"] = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
    if (status && status !== "all") where["status"] = status;

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where, skip, take: limit,
        include: { _count: { select: { members: true, modules: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({ organizations, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/organizations/:id ─────────────────────────────────────────
sadminRouter.get("/organizations/:id", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params["id"]! },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, isAdmin: true } } },
          orderBy: { joinedAt: "asc" },
        },
        modules: { orderBy: { installedAt: "desc" } },
      },
    });
    if (!org) throw new AppError(404, "Organization not found");
    res.json({ organization: org });
  } catch (err) { next(err); }
});

const updateOrgSchema = z.object({
  plan:      z.enum(["starter", "growth", "pro", "enterprise"]).optional(),
  status:    z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
  trialEnds: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
});

// ── PATCH /api/sadmin/organizations/:id ───────────────────────────────────────
sadminRouter.patch("/organizations/:id", async (req, res, next) => {
  try {
    const data = updateOrgSchema.parse(req.body);
    const update: Record<string, unknown> = {};
    if (data.plan      !== undefined) update["plan"]      = data.plan;
    if (data.status    !== undefined) update["status"]    = data.status;
    if (data.trialEnds !== undefined) update["trialEnds"] = data.trialEnds;
    const org = await prisma.organization.update({ where: { id: req.params["id"]! }, data: update });

    // Invalidate tenant cache so status/plan changes take effect immediately
    await cacheDel(`org:tenant:${req.params["id"]!}`, `billing:status:${req.params["id"]!}`);

    res.json({ organization: org });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// ── DELETE /api/sadmin/organizations/:id ──────────────────────────────────────
sadminRouter.delete("/organizations/:id", async (req, res, next) => {
  try {
    await prisma.organization.update({ where: { id: req.params["id"]! }, data: { status: "cancelled" } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/users ─────────────────────────────────────────────────────
sadminRouter.get("/users", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "25"))));
    const skip   = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    const where = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip, take: limit,
        select: {
          id: true, name: true, email: true, isAdmin: true, createdAt: true,
          memberships: {
            select: {
              role: true,
              organization: { select: { id: true, name: true, plan: true, status: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── PATCH /api/sadmin/users/:id — toggle isAdmin ──────────────────────────────
sadminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const { isAdmin } = z.object({ isAdmin: z.boolean() }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params["id"]! },
      data: { isAdmin },
      select: { id: true, email: true, name: true, isAdmin: true },
    });
    res.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// ── GET /api/sadmin/plans ─────────────────────────────────────────────────────
sadminRouter.get("/plans", async (_req, res, next) => {
  try {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [current, lastMonth] = await Promise.all([
      prisma.organization.groupBy({ by: ["plan"], _count: { id: true }, where: { status: { in: ["active", "trial"] } } }),
      prisma.organization.groupBy({ by: ["plan"], _count: { id: true }, where: { status: { in: ["active", "trial"] }, createdAt: { lte: monthAgo } } }),
    ]);

    const lastMonthMap: Record<string, number> = {};
    lastMonth.forEach((r) => { lastMonthMap[r.plan] = r._count.id; });

    const plans = current.map((row) => {
      const prev  = lastMonthMap[row.plan] ?? 0;
      const count = row._count.id;
      return {
        plan: row.plan,
        count,
        pricePerMonth: platformSettings.planPrices[row.plan] ?? 0,
        mrr: count * (platformSettings.planPrices[row.plan] ?? 0),
        delta: count - prev,
      };
    });

    const totalMrr = plans.reduce((s, p) => s + p.mrr, 0);
    res.json({ plans, totalMrr });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/submissions ───────────────────────────────────────────────
sadminRouter.get("/submissions", async (req, res, next) => {
  try {
    const status = String(req.query["status"] ?? "").trim();
    const where = status && status !== "all" ? { status: status as "pending" | "approved" | "rejected" } : {};

    const submissions = await prisma.moduleSubmission.findMany({
      where,
      include: {
        developer: { include: { user: { select: { id: true, name: true, email: true } } } },
        module: true,
      },
      orderBy: { submittedAt: "desc" },
    });
    const pendingCount = await prisma.moduleSubmission.count({ where: { status: "pending" } });
    res.json({ submissions, pendingCount });
  } catch (err) { next(err); }
});

const reviewSchema = z.object({
  status:     z.enum(["approved", "rejected"]),
  reviewNote: z.string().max(1000).optional(),
});

// ── PATCH /api/sadmin/submissions/:id ─────────────────────────────────────────
sadminRouter.patch("/submissions/:id", async (req, res, next) => {
  try {
    const data = reviewSchema.parse(req.body);
    const submission = await prisma.moduleSubmission.findUnique({
      where: { id: req.params["id"]! },
      include: { developer: { include: { user: true } } },
    });
    if (!submission) throw new AppError(404, "Submission not found");
    if (submission.status !== "pending") throw new AppError(400, "Submission already reviewed");

    if (data.status === "approved") {
      await prisma.$transaction([
        prisma.moduleSubmission.update({
          where: { id: submission.id },
          data: { status: "approved", reviewNote: data.reviewNote ?? null, reviewedAt: new Date() },
        }),
        prisma.marketplaceModule.create({
          data: {
            submissionId: submission.id,
            key:          submission.key,
            name:         submission.name,
            version:      submission.version,
            category:     submission.category,
            description:  submission.description,
            author:       submission.developer.user.name,
            repoUrl:      submission.repoUrl,
          },
        }),
      ]);
    } else {
      await prisma.moduleSubmission.update({
        where: { id: submission.id },
        data: { status: "rejected", reviewNote: data.reviewNote ?? null, reviewedAt: new Date() },
      });
    }
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// ── POST /api/sadmin/organizations/:id/impersonate ────────────────────────────
sadminRouter.post("/organizations/:id/impersonate", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params["id"]! },
      include: { members: { where: { role: "owner" }, take: 1 } },
    });
    if (!org) throw new AppError(404, "Organization not found");

    const ownerMember = org.members[0];
    if (!ownerMember) throw new AppError(400, "Organization has no owner");

    const adminToken = req.cookies["access_token"] as string;
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 8 * 60 * 60 * 1000,
    };

    const impersonationPayload: JwtPayload = {
      userId:       ownerMember.userId,
      orgId:        org.id,
      role:         ownerMember.role,
      isAdmin:      false,
      impersonated: true,
    };
    const impersonationToken = jwt.sign(
      impersonationPayload,
      process.env.JWT_SECRET ?? "secret",
      { expiresIn: "8h" },
    );

    // Track impersonation token so it can be audited and revoked via session management
    (prisma.userSession as typeof prisma.userSession | undefined)?.create?.({
      data: {
        userId: ownerMember.userId,
        tokenHash: crypto.createHash("sha256").update(impersonationToken).digest("hex"),
      },
    })?.catch(() => {});

    res
      .cookie("admin_session", adminToken, cookieOpts)
      .cookie("access_token", impersonationToken, cookieOpts)
      .json({ success: true, orgName: org.name, orgSlug: org.slug });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/organizations/:id/backup ──────────────────────────────────
sadminRouter.get("/organizations/:id/backup", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params["id"]! },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true, createdAt: true } } },
          orderBy: { joinedAt: "asc" },
        },
        modules: { orderBy: { installedAt: "asc" } },
      },
    });
    if (!org) throw new AppError(404, "Organization not found");

    let tenantDatabase: Record<string, unknown[]> | null = null;
    if (org.dbUrl) {
      tenantDatabase = {};
      try {
        const tenantDb = getTenantClient(org.dbUrl);
        const tables = await tenantDb.$queryRaw<{ tablename: string }[]>`
          SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
        `;
        // Validate table names against safe identifier pattern before using in raw query
        const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        const ROW_EXPORT_LIMIT = 10_000;
        for (const { tablename } of tables) {
          if (!SAFE_IDENTIFIER.test(tablename)) continue; // skip malformed names
          const rows = await tenantDb.$queryRawUnsafe<unknown[]>(
            `SELECT * FROM "${tablename}" LIMIT ${ROW_EXPORT_LIMIT}`
          );
          tenantDatabase[tablename] = rows;
        }
      } catch {
        tenantDatabase["_error"] = ["Failed to connect to tenant database"];
      }
    }

    const { dbUrl: _omit, ...orgData } = org;
    res.json({
      exportedAt: new Date().toISOString(),
      version: "1.0",
      organization: orgData,
      tenantDatabase,
    });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/backup — bulk platform export ─────────────────────────────
sadminRouter.get("/backup", async (_req, res, next) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        modules: true,
        _count: { select: { members: true, modules: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const safe = organizations.map(({ dbUrl: _omit, ...o }) => o);

    res.json({
      exportedAt: new Date().toISOString(),
      version: "1.0",
      totalOrganizations: organizations.length,
      organizations: safe,
    });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/marketplace ───────────────────────────────────────────────
sadminRouter.get("/marketplace", async (_req, res, next) => {
  try {
    const modules = await prisma.marketplaceModule.findMany({
      include: {
        submission: {
          include: {
            developer: { include: { user: { select: { id: true, name: true, email: true } } } },
          },
        },
      },
      orderBy: { publishedAt: "desc" },
    });
    res.json({ modules });
  } catch (err) { next(err); }
});

const updateMarketplaceSchema = z.object({
  isActive: z.boolean().optional(),
  price:    z.number().min(0).optional(),
  billing:  z.enum(["free", "monthly", "yearly"]).optional(),
});

// ── PATCH /api/sadmin/marketplace/:id ─────────────────────────────────────────
sadminRouter.patch("/marketplace/:id", async (req, res, next) => {
  try {
    const data = updateMarketplaceSchema.parse(req.body);
    const module = await prisma.marketplaceModule.update({
      where: { id: req.params["id"]! },
      data,
    });
    res.json({ module });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// ── DELETE /api/sadmin/marketplace/:id ────────────────────────────────────────
sadminRouter.delete("/marketplace/:id", async (req, res, next) => {
  try {
    await prisma.marketplaceModule.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── GET /api/sadmin/settings ──────────────────────────────────────────────────
sadminRouter.get("/settings", (_req, res) => {
  res.json({ settings: platformSettings });
});

const settingsSchema = z.object({
  planPrices: z.object({
    starter:    z.number().min(0),
    growth:     z.number().min(0),
    pro:        z.number().min(0),
    enterprise: z.number().min(0),
  }).optional(),
  trialDays:       z.number().int().min(1).max(365).optional(),
  maintenanceMode: z.boolean().optional(),
  announcement:    z.string().max(500).optional(),
});

// ── PATCH /api/sadmin/settings ────────────────────────────────────────────────
sadminRouter.patch("/settings", (req, res, next) => {
  try {
    const data = settingsSchema.parse(req.body);
    if (data.planPrices)               platformSettings.planPrices     = data.planPrices;
    if (data.trialDays !== undefined)   platformSettings.trialDays      = data.trialDays;
    if (data.maintenanceMode !== undefined) platformSettings.maintenanceMode = data.maintenanceMode;
    if (data.announcement !== undefined)    platformSettings.announcement    = data.announcement;
    savePlatformSettings();
    res.json({ settings: platformSettings });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// ── GET /api/sadmin/plans/config ──────────────────────────────────────────────
sadminRouter.get("/plans/config", (_req, res) => {
  res.json({ planConfigs: platformSettings.planConfigs });
});

const featureSchema = z.object({
  text:     z.string().min(1).max(150),
  included: z.boolean(),
});

const singlePlanSchema = z.object({
  key:         z.string().min(1).max(20),
  name:        z.string().min(1).max(40),
  description: z.string().min(1).max(200),
  price:       z.number().min(0),
  yearlyPrice: z.number().min(0),
  memberLimit: z.number().int().min(0),
  isPopular:   z.boolean(),
  ctaText:     z.string().min(1).max(30),
  features:    z.array(featureSchema).min(1).max(20),
});

const planConfigsBodySchema = z.object({
  planConfigs: z.array(singlePlanSchema).min(1).max(10),
});

// ── PATCH /api/sadmin/plans/config ────────────────────────────────────────────
sadminRouter.patch("/plans/config", (req, res, next) => {
  try {
    const { planConfigs } = planConfigsBodySchema.parse(req.body);
    platformSettings.planConfigs = planConfigs;
    // Keep planPrices in sync so MRR calculations stay accurate
    for (const plan of planConfigs) {
      platformSettings.planPrices[plan.key] = plan.price;
    }
    savePlatformSettings();
    res.json({ planConfigs: platformSettings.planConfigs });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// ── ERPAI management routes ───────────────────────────────────────────────────
// __dirname = apps/api/src/routes → 4 up → repo root
const ERPAI_ROOT     = path.resolve(__dirname, "../../../../erpai/data");
const AI_LOG_PATH    = path.join(ERPAI_ROOT, "ai-log.json");
const AI_CONFIG_PATH = path.join(ERPAI_ROOT, "ai-config.json");
const AI_TASKS_PATH  = path.join(ERPAI_ROOT, "tasks.json");

interface AILogEntry {
  id: string; timestamp: string;
  type: "chat" | "analyze" | "task_suggest";
  prompt: string; model: string;
  inputTokens: number; outputTokens: number;
  cacheReadTokens: number; cacheCreationTokens: number;
  durationMs: number; status: "success" | "error"; error?: string;
}
interface AIConfig {
  model: string;
  features: { chat: boolean; analyze: boolean; taskSuggest: boolean };
  maxLogEntries: number;
  chatMaxTokens: number;
  analyzeMaxTokens: number;
  analyzeMaxIterations: number;
}
interface ERPAITask {
  id: string; title: string; description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  category: string; createdAt: string; updatedAt: string;
}

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as T; }
  catch { return fallback; }
}
function writeJson(p: string, data: unknown): void {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}

const DEFAULT_CONFIG: AIConfig = {
  model: "claude-opus-4-7",
  features: { chat: true, analyze: true, taskSuggest: true },
  maxLogEntries: 500,
  chatMaxTokens: 64000,
  analyzeMaxTokens: 16000,
  analyzeMaxIterations: 12,
};

// GET /api/sadmin/ai-log
sadminRouter.get("/ai-log", (req, res) => {
  let entries = readJson<AILogEntry[]>(AI_LOG_PATH, []).slice().reverse();

  const { type, status } = req.query as { type?: string; status?: string };
  if (type && type !== "all") entries = entries.filter((e) => e.type === type);
  if (status && status !== "all") entries = entries.filter((e) => e.status === status);

  const page  = Math.max(1, parseInt(String(req.query.page  ?? "1"), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "25"), 10)));
  const total = entries.length;
  const paged = entries.slice((page - 1) * limit, page * limit);

  const all = readJson<AILogEntry[]>(AI_LOG_PATH, []);
  const stats = {
    total: all.length,
    errors: all.filter((e) => e.status === "error").length,
    totalInputTokens:     all.reduce((s, e) => s + (e.inputTokens ?? 0), 0),
    totalOutputTokens:    all.reduce((s, e) => s + (e.outputTokens ?? 0), 0),
    totalCacheReadTokens: all.reduce((s, e) => s + (e.cacheReadTokens ?? 0), 0),
    avgDurationMs: all.length
      ? Math.round(all.reduce((s, e) => s + e.durationMs, 0) / all.length) : 0,
    byType: {
      chat:         all.filter((e) => e.type === "chat").length,
      analyze:      all.filter((e) => e.type === "analyze").length,
      task_suggest: all.filter((e) => e.type === "task_suggest").length,
    },
  };
  res.json({ entries: paged, total, page, limit, pages: Math.ceil(total / limit), stats });
});

// DELETE /api/sadmin/ai-log  — clear the log
sadminRouter.delete("/ai-log", (_req, res) => {
  try { writeJson(AI_LOG_PATH, []); }
  catch { /* ignore */ }
  res.json({ ok: true });
});

// GET /api/sadmin/erpai/config
sadminRouter.get("/erpai/config", (_req, res) => {
  const stored = readJson<Partial<AIConfig>>(AI_CONFIG_PATH, {});
  res.json({ config: { ...DEFAULT_CONFIG, ...stored } });
});

// PATCH /api/sadmin/erpai/config
const erpaiConfigSchema = z.object({
  model:               z.string().optional(),
  features:            z.object({
    chat:        z.boolean(),
    analyze:     z.boolean(),
    taskSuggest: z.boolean(),
  }).optional(),
  maxLogEntries:        z.number().int().min(10).max(5000).optional(),
  chatMaxTokens:        z.number().int().min(1024).max(200000).optional(),
  analyzeMaxTokens:     z.number().int().min(1024).max(64000).optional(),
  analyzeMaxIterations: z.number().int().min(1).max(30).optional(),
});
sadminRouter.patch("/erpai/config", (req, res, next) => {
  try {
    const patch = erpaiConfigSchema.parse(req.body);
    const current = { ...DEFAULT_CONFIG, ...readJson<Partial<AIConfig>>(AI_CONFIG_PATH, {}) };
    const updated = { ...current, ...patch, features: { ...current.features, ...(patch.features ?? {}) } };
    writeJson(AI_CONFIG_PATH, updated);
    res.json({ config: updated });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// GET /api/sadmin/erpai/tasks
sadminRouter.get("/erpai/tasks", (_req, res) => {
  const tasks = readJson<ERPAITask[]>(AI_TASKS_PATH, []);
  const stats = {
    total:      tasks.length,
    todo:       tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done:       tasks.filter((t) => t.status === "done").length,
    high:       tasks.filter((t) => t.priority === "high" && t.status !== "done").length,
  };
  res.json({ tasks: tasks.slice().reverse(), stats });
});

const patchTaskSchema = z.object({
  status:   z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category:    z.string().max(100).optional(),
});

// PATCH /api/sadmin/erpai/tasks/:id — update status or priority
sadminRouter.patch("/erpai/tasks/:id", (req, res, next) => {
  try {
    const patch = patchTaskSchema.parse(req.body);
    const tasks = readJson<ERPAITask[]>(AI_TASKS_PATH, []);
    const idx = tasks.findIndex((t) => t.id === req.params["id"]);
    if (idx === -1) { res.status(404).json({ error: "Task not found" }); return; }
    tasks[idx] = { ...tasks[idx]!, ...patch, updatedAt: new Date().toISOString() } as ERPAITask;
    writeJson(AI_TASKS_PATH, tasks);
    res.json(tasks[idx]);
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /api/sadmin/erpai/tasks/:id
sadminRouter.delete("/erpai/tasks/:id", (req, res) => {
  const tasks = readJson<ERPAITask[]>(AI_TASKS_PATH, []);
  const filtered = tasks.filter((t) => t.id !== req.params["id"]);
  if (filtered.length === tasks.length) { res.status(404).json({ error: "Task not found" }); return; }
  writeJson(AI_TASKS_PATH, filtered);
  res.json({ ok: true });
});
