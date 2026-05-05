import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const adminRouter = Router();

// All admin routes require auth + owner-level role
adminRouter.use(requireAuth);
adminRouter.use(requireRole("owner"));

// ── GET /api/admin/stats — platform overview ──────────────────────────────────
adminRouter.get("/stats", async (_req, res, next) => {
  try {
    const [totalOrgs, totalUsers, orgsByPlan, orgsByStatus] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.organization.groupBy({ by: ["plan"], _count: { id: true } }),
      prisma.organization.groupBy({ by: ["status"], _count: { id: true } }),
    ]);

    res.json({ totalOrgs, totalUsers, orgsByPlan, orgsByStatus });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/organizations — list all orgs ──────────────────────────────
adminRouter.get("/organizations", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
    const skip  = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    const where = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { slug: { contains: search, mode: "insensitive" as const } }] }
      : {};

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: { select: { members: true, modules: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({ organizations, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/organizations/:id — single org detail ──────────────────────
adminRouter.get("/organizations/:id", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.params["id"]! },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
        modules: true,
      },
    });
    if (!org) throw new AppError(404, "Organization not found");
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
});

const updateOrgSchema = z.object({
  plan:   z.enum(["starter", "growth", "pro", "enterprise"]).optional(),
  status: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
});

// ── PATCH /api/admin/organizations/:id — update plan / status ─────────────────
adminRouter.patch("/organizations/:id", async (req, res, next) => {
  try {
    const data = updateOrgSchema.parse(req.body);
    const org = await prisma.organization.update({
      where: { id: req.params["id"]! },
      data,
    });
    res.json({ organization: org });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// ── DELETE /api/admin/organizations/:id — suspend org ─────────────────────────
adminRouter.delete("/organizations/:id", async (req, res, next) => {
  try {
    await prisma.organization.update({
      where: { id: req.params["id"]! },
      data: { status: "cancelled" },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/users — list all users ─────────────────────────────────────
adminRouter.get("/users", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
    const skip  = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    const where = search
      ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, name: true, email: true, createdAt: true,
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
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/plans — plan summary ───────────────────────────────────────
adminRouter.get("/plans", async (_req, res, next) => {
  try {
    const PLAN_PRICES: Record<string, number> = { starter: 29, growth: 79, pro: 149, enterprise: 299 };

    const orgsByPlan = await prisma.organization.groupBy({
      by: ["plan"],
      _count: { id: true },
      where: { status: { in: ["active", "trial"] } },
    });

    const plans = orgsByPlan.map((row) => ({
      plan: row.plan,
      count: row._count.id,
      pricePerMonth: PLAN_PRICES[row.plan] ?? 0,
      mrr: row._count.id * (PLAN_PRICES[row.plan] ?? 0),
    }));

    const totalMrr = plans.reduce((s, p) => s + p.mrr, 0);

    res.json({ plans, totalMrr });
  } catch (err) {
    next(err);
  }
});
