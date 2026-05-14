import { Router } from "express";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { provisionTenantDb } from "../services/orgProvisionService";
import { installModule } from "../engine/module_installer";
import { getAllManifests, planIncludes } from "@business360/engine";
import type { Plan } from "@business360/engine";
import type { PlanTier } from "../engine/types";
import type { JwtPayload } from "../types";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export const orgRouter = Router();
orgRouter.use(requireAuth);

/**
 * @openapi
 * /api/organizations:
 *   post:
 *     tags: [Organizations]
 *     summary: Create a new organization
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, plan, userCount]
 *             properties:
 *               name: { type: string }
 *               plan: { type: string, enum: [starter, growth, pro, enterprise] }
 *               userCount: { type: integer, minimum: 1, maximum: 1000 }
 *     responses:
 *       201:
 *         description: Organization created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 org: { $ref: '#/components/schemas/Organization' }
 *   get:
 *     tags: [Organizations]
 *     summary: List organizations the current user belongs to
 *     responses:
 *       200:
 *         description: List of organizations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 organizations:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Organization' }
 */

/**
 * @openapi
 * /api/organizations/{id}:
 *   get:
 *     tags: [Organizations]
 *     summary: Get organization details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Organization details
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Organization' }
 *       403:
 *         description: Not a member of this organization
 *   patch:
 *     tags: [Organizations]
 *     summary: Update organization settings
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Updated organization
 */

const createOrgSchema = z.object({
  name: z.string().min(1),
  plan: z.enum(["starter", "growth", "pro", "enterprise"]),
  userCount: z.number().int().min(1).max(1000),
});

orgRouter.post("/", async (req, res, next) => {
  try {
    const data = createOrgSchema.parse(req.body);
    const userId = req.user!.userId;

    const org = await prisma.organization.create({
      data: {
        name: data.name,
        plan: data.plan,
        userCount: data.userCount,
        members: { create: { userId, role: "owner" } },
      },
    });

    // Provision isolated tenant DB
    await provisionTenantDb(org.id, org.slug);

    // Auto-install all modules the chosen plan includes (engine registry is source of truth)
    const eligible = getAllManifests().filter((m) =>
      planIncludes(data.plan as Plan, m.requiredPlan)
    );
    await Promise.all(eligible.map((m) => installModule(org.id, m.key, data.plan as PlanTier)));

    const orgWithDb = await prisma.organization.findUnique({ where: { id: org.id } });

    // Re-issue JWT with the new orgId so the frontend reflects membership immediately
    const newPayload: JwtPayload = { userId, orgId: org.id, role: "owner", isAdmin: false };
    const newToken = jwt.sign(newPayload, process.env.JWT_SECRET ?? "secret", { expiresIn: "7d" });

    // Track session for revocation support
    const { createHash } = await import("crypto");
    prisma.userSession.create({
      data: { userId, tokenHash: createHash("sha256").update(newToken).digest("hex") },
    }).catch(() => {});

    res
      .cookie("access_token", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: COOKIE_MAX_AGE,
      })
      .status(201)
      .json({ organization: orgWithDb });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

orgRouter.get("/", async (req, res, next) => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { members: { some: { userId: req.user!.userId } } },
    });
    res.json({ organizations: orgs });
  } catch (err) {
    next(err);
  }
});

const ALLOWED_CURRENCIES = [
  "USD","EUR","GBP","JPY","CNY","INR","CAD","AUD","CHF","MXN",
  "BRL","KRW","SGD","HKD","NOK","SEK","DKK","NZD","ZAR","AED",
  "SAR","THB","IDR","MYR","PHP","TRY","PLN","CZK","HUF","RON",
  "QAR","KWD","EGP","NGN","PKR","BDT","VND","UAH","ILS","CLP",
];

const updateOrgSettingsSchema = z.object({
  currency: z.string().refine((v) => ALLOWED_CURRENCIES.includes(v), "Unsupported currency"),
});

orgRouter.patch("/settings", async (req, res, next) => {
  try {
    const user = req.user!;
    if (!user.orgId) throw new AppError(400, "No organization");
    if (user.role !== "owner") throw new AppError(403, "Requires owner role");

    const data = updateOrgSettingsSchema.parse(req.body);
    await prisma.organization.update({ where: { id: user.orgId }, data: { currency: data.currency } });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});

orgRouter.get("/current", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    if (!orgId) return res.json({ organization: null });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
        modules: { where: { isActive: true } },
      },
    });
    if (!org) return res.json({ organization: null });

    const currencyRows = await prisma.$queryRaw<{ currency: string }[]>`
      SELECT currency FROM organizations WHERE id = ${orgId}
    `;
    const currency = currencyRows[0]?.currency ?? "USD";
    res.json({ organization: { ...org, currency } });
  } catch (err) {
    next(err);
  }
});
