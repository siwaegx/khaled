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
    const newPayload: JwtPayload = { userId, orgId: org.id, role: "owner" };
    const newToken = jwt.sign(newPayload, process.env.JWT_SECRET ?? "secret", { expiresIn: "7d" });
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
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
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
    res.json({ organization: org });
  } catch (err) {
    next(err);
  }
});
