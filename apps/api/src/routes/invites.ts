import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import { sendOrgInviteEmail } from "../services/emailService";
import { platformSettings } from "./sadmin";

export const invitesRouter = Router();

// Prisma cast — orgInvite not in generated types until Prisma client is regenerated
type InviteRecord = {
  id: string; organizationId: string; email: string; role: string;
  token: string; invitedBy: string; expiresAt: Date; acceptedAt: Date | null; createdAt: Date;
};
type InviteClient = {
  create:     (a: unknown) => Promise<InviteRecord>;
  findMany:   (a: unknown) => Promise<InviteRecord[]>;
  findUnique: (a: unknown) => Promise<(InviteRecord & Record<string, unknown>) | null>;
  update:     (a: unknown) => Promise<InviteRecord>;
  delete:     (a: unknown) => Promise<void>;
};
const inviteDb = (prisma as unknown as { orgInvite: InviteClient }).orgInvite;

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

// ── GET /verify?token= — public, no auth ──────────────────────────────────────
invitesRouter.get("/verify", async (req, res, next) => {
  try {
    const token = String(req.query["token"] ?? "");
    if (!token) throw new AppError(400, "Token required");

    const invite = await inviteDb.findUnique({
      where: { token },
      include: {
        organization: { select: { name: true } },
        inviter:      { select: { name: true } },
      },
    });

    if (!invite)           throw new AppError(404, "Invite not found");
    if (invite.acceptedAt) throw new AppError(410, "This invite has already been accepted");
    if (new Date() > invite.expiresAt) throw new AppError(410, "This invite has expired");

    const org     = invite["organization"] as { name: string } | undefined;
    const inviter = invite["inviter"]      as { name: string } | undefined;

    res.json({
      email:       invite.email,
      role:        invite.role,
      orgName:     org?.name     ?? "",
      inviterName: inviter?.name ?? "",
      expiresAt:   invite.expiresAt,
    });
  } catch (err) { next(err); }
});

// ── POST /accept — requires auth, any role ────────────────────────────────────
invitesRouter.post("/accept", requireAuth, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    const { userId } = req.user!;

    const invite = await inviteDb.findUnique({ where: { token } });
    if (!invite)           throw new AppError(404, "Invite not found");
    if (invite.acceptedAt) throw new AppError(410, "Invite already accepted");
    if (new Date() > invite.expiresAt) throw new AppError(410, "Invite has expired");

    // Verify the accepting user's email matches the invite target
    const acceptingUser = await prisma.user.findUnique({ where: { id: userId! }, select: { email: true } });
    if (!acceptingUser || acceptingUser.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new AppError(403, "This invite was not sent to your email address");
    }

    // Check if already a member
    const already = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: userId!, organizationId: invite.organizationId } },
    });
    if (already) throw new AppError(409, "You are already a member of this organization");

    // Add to org + mark accepted
    await prisma.orgMember.create({
      data: { userId: userId!, organizationId: invite.organizationId, role: invite.role as "owner" | "manager" | "member" },
    });
    await inviteDb.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });

    res.json({ success: true, orgId: invite.organizationId });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// ── Management routes — require auth + manager role ───────────────────────────
invitesRouter.use(requireAuth);
invitesRouter.use(requireRole("manager"));

// GET / — list pending invites
invitesRouter.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization");

    const invites = await inviteDb.findMany({
      where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } as unknown },
      include: { inviter: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }) as (InviteRecord & { inviter?: { name: string } })[];

    res.json({
      invites: invites.map((inv) => ({
        id: inv.id, email: inv.email, role: inv.role,
        expiresAt: inv.expiresAt, createdAt: inv.createdAt,
        inviterName: inv.inviter?.name,
      })),
    });
  } catch (err) { next(err); }
});

// POST / — create and send invite
invitesRouter.post("/", async (req, res, next) => {
  try {
    const { email, role } = z.object({
      email: z.string().email(),
      role:  z.enum(["manager", "member"]).default("member"),
    }).parse(req.body);

    const { orgId, userId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization");

    // Already a member?
    const existing = await prisma.orgMember.findFirst({
      where: { organizationId: orgId, user: { email } },
    });
    if (existing) throw new AppError(409, "This person is already a member of your organization");

    // Enforce plan member limit
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } });
    const planConfig = platformSettings.planConfigs.find((p) => p.key === org?.plan);
    if (planConfig && planConfig.memberLimit > 0) {
      const currentCount = await prisma.orgMember.count({ where: { organizationId: orgId } });
      const pendingCount = await (prisma as unknown as { orgInvite: { count: (a: unknown) => Promise<number> } }).orgInvite.count({
        where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      });
      if (currentCount + pendingCount >= planConfig.memberLimit) {
        throw new AppError(403, `Your ${planConfig.name} plan allows a maximum of ${planConfig.memberLimit} members. Please upgrade to invite more.`);
      }
    }

    // Get org + inviter details
    const [org, inviter] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId } }),
      prisma.user.findUnique({ where: { id: userId! } }),
    ]);
    if (!org || !inviter) throw new AppError(404, "Organization not found");

    const token     = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await inviteDb.create({
      data: { organizationId: orgId, email, role, token, invitedBy: userId!, expiresAt },
    });

    const acceptUrl = `${WEB_URL}/invite?token=${token}`;
    let emailError: string | null = null;
    try {
      await sendOrgInviteEmail(email, inviter.name, org.name, role, acceptUrl);
    } catch (emailErr) {
      emailError = String(emailErr);
      console.error("[invites] Email send failed:", emailErr);
    }

    res.status(201).json({ invite: { id: invite.id, email, role, expiresAt }, emailError });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /:id — cancel an invite
invitesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { orgId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization");
    await inviteDb.delete({ where: { id: req.params["id"]!, organizationId: orgId } as unknown });
    res.json({ success: true });
  } catch (err) { next(err); }
});
