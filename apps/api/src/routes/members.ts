import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { platformSettings } from "./sadmin";

export const membersRouter = Router();
membersRouter.use(requireAuth);

const ALL_ROLES = ["owner", "manager", "sales_leader", "inventory_manager", "accountant", "engineer", "service_agent", "member"] as const;
type OrgRoleValue = typeof ALL_ROLES[number];

// GET /api/org/members
membersRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No active organization");
    const members = await prisma.orgMember.findMany({
      where:   { organizationId: orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
    res.json({ members });
  } catch (err) { next(err); }
});

// POST /api/org/members — add user directly (owner-only)
const addMemberSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role:     z.enum(ALL_ROLES),
});

membersRouter.post("/", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const { name, email, password, role } = addMemberSchema.parse(req.body);

    // Enforce plan member limit
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    const planConfig = platformSettings.planConfigs.find((p) => p.key === org?.plan);
    if (planConfig && planConfig.memberLimit > 0) {
      const currentCount = await prisma.orgMember.count({ where: { organizationId: orgId } });
      if (currentCount >= planConfig.memberLimit) {
        throw new AppError(403, `Your ${planConfig.name} plan allows a maximum of ${planConfig.memberLimit} members. Please upgrade to add more.`);
      }
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const existing = await prisma.orgMember.findUnique({
        where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      });
      if (existing) throw new AppError(409, "This user is already a member of the organization");
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      user = await prisma.user.create({ data: { email, name, passwordHash } });
    }

    const member = await prisma.orgMember.create({
      data:    { userId: user.id, organizationId: orgId, role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.status(201).json({ member });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// PATCH /api/org/members/:memberId — edit full member details (owner-only)
const editMemberSchema = z.object({
  name:     z.string().min(1, "Name is required").optional(),
  email:    z.string().email("Invalid email address").optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  role:     z.enum(ALL_ROLES).optional(),
});

membersRouter.patch("/:memberId", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId    = req.user!.orgId!;
    const callerId = req.user!.userId;
    const { memberId } = req.params;
    const data = editMemberSchema.parse(req.body);

    const target = await prisma.orgMember.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { user: true },
    });
    if (!target) throw new AppError(404, "Member not found");

    // Role change guards
    if (data.role && data.role !== target.role) {
      if (target.userId === callerId) throw new AppError(400, "Cannot change your own role");
      if (target.role === "owner" && data.role !== "owner") {
        const ownerCount = await prisma.orgMember.count({ where: { organizationId: orgId, role: "owner" } });
        if (ownerCount <= 1) throw new AppError(400, "Cannot demote the only owner");
      }
    }

    // Email uniqueness check (exclude current user)
    if (data.email && data.email !== target.user.email) {
      const conflict = await prisma.user.findUnique({ where: { email: data.email } });
      if (conflict && conflict.id !== target.userId) throw new AppError(409, "This email is already in use by another account");
    }

    // Update User record
    const userUpdate: Record<string, string> = {};
    if (data.name)     userUpdate.name  = data.name;
    if (data.email)    userUpdate.email = data.email;
    if (data.password) userUpdate.passwordHash = await bcrypt.hash(data.password, 12);

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: target.userId }, data: userUpdate });
    }

    // Update OrgMember role if changed; invalidate existing tokens when role changes
    const roleToSave = (data.role ?? target.role) as OrgRoleValue;
    const roleChanged = data.role && data.role !== target.role;
    const updated = await prisma.orgMember.update({
      where:   { id: memberId },
      data:    { role: roleToSave, ...(roleChanged ? { tokenIssuedBefore: new Date() } : {}) },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({ member: updated });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// PATCH /api/org/members/:memberId/role — kept for backward compat
const patchRoleSchema = z.object({ role: z.enum(ALL_ROLES) });

membersRouter.patch("/:memberId/role", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId    = req.user!.orgId!;
    const callerId = req.user!.userId;
    const { memberId } = req.params;
    const { role } = patchRoleSchema.parse(req.body);

    const target = await prisma.orgMember.findFirst({ where: { id: memberId, organizationId: orgId } });
    if (!target) throw new AppError(404, "Member not found");
    if (target.userId === callerId) throw new AppError(400, "Cannot change your own role");
    if (target.role === "owner" && role !== "owner") {
      const ownerCount = await prisma.orgMember.count({ where: { organizationId: orgId, role: "owner" } });
      if (ownerCount <= 1) throw new AppError(400, "Cannot demote the only owner");
    }

    const updated = await prisma.orgMember.update({
      where:   { id: memberId },
      data:    { role, tokenIssuedBefore: new Date() },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ member: updated });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /api/org/members/:memberId
membersRouter.delete("/:memberId", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId    = req.user!.orgId!;
    const callerId = req.user!.userId;
    const { memberId } = req.params;

    const target = await prisma.orgMember.findFirst({ where: { id: memberId, organizationId: orgId } });
    if (!target) throw new AppError(404, "Member not found");
    if (target.userId === callerId) throw new AppError(400, "Cannot remove yourself");
    if (target.role === "owner") {
      const ownerCount = await prisma.orgMember.count({ where: { organizationId: orgId, role: "owner" } });
      if (ownerCount <= 1) throw new AppError(400, "Cannot remove the only owner");
    }

    await prisma.orgMember.delete({ where: { id: memberId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
