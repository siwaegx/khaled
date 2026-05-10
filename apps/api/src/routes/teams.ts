import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

// Cast to any so routes degrade gracefully when migration hasn't been applied yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function migrationPending(): boolean {
  return !db.orgTeam || !db.orgTeamMember;
}

const teamInclude = {
  leader:  { include: { user: { select: { id: true, name: true, email: true } } } },
  members: { include: { member: { include: { user: { select: { id: true, name: true, email: true } } } } } },
};

// GET /api/org/teams
teamsRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No active organization");

    if (migrationPending()) { res.json({ teams: [] }); return; }

    const teams = await db.orgTeam.findMany({
      where: { organizationId: orgId },
      include: teamInclude,
      orderBy: { createdAt: "asc" },
    });

    res.json({ teams });
  } catch (err) { next(err); }
});

const createTeamSchema = z.object({
  name:      z.string().min(1).max(80),
  moduleKey: z.string().min(1),
  leaderId:  z.string().optional(),
});

// POST /api/org/teams
teamsRouter.post("/", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;

    if (migrationPending()) {
      res.status(503).json({ error: "Run database migration to enable Teams. See EXPLAIN.txt." });
      return;
    }

    const data = createTeamSchema.parse(req.body);

    if (data.leaderId) {
      const leader = await prisma.orgMember.findFirst({ where: { id: data.leaderId, organizationId: orgId } });
      if (!leader) throw new AppError(400, "Leader not in this organization");
    }

    const team = await db.orgTeam.create({
      data: { organizationId: orgId, name: data.name, moduleKey: data.moduleKey, leaderId: data.leaderId ?? null },
      include: teamInclude,
    });

    res.status(201).json({ team });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

const patchTeamSchema = z.object({
  name:     z.string().min(1).max(80).optional(),
  leaderId: z.string().nullable().optional(),
});

// PATCH /api/org/teams/:id
teamsRouter.patch("/:id", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId  = req.user!.orgId!;
    const { id } = req.params;

    if (migrationPending()) {
      res.status(503).json({ error: "Run database migration to enable Teams." });
      return;
    }

    const data = patchTeamSchema.parse(req.body);

    const team = await db.orgTeam.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new AppError(404, "Team not found");

    if (data.leaderId) {
      const leader = await prisma.orgMember.findFirst({ where: { id: data.leaderId, organizationId: orgId } });
      if (!leader) throw new AppError(400, "Leader not in this organization");
    }

    const updated = await db.orgTeam.update({
      where: { id },
      data: {
        ...(data.name     !== undefined && { name: data.name }),
        ...(data.leaderId !== undefined && { leaderId: data.leaderId }),
      },
      include: teamInclude,
    });

    res.json({ team: updated });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /api/org/teams/:id
teamsRouter.delete("/:id", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId  = req.user!.orgId!;
    const { id } = req.params;

    if (migrationPending()) {
      res.status(503).json({ error: "Run database migration to enable Teams." });
      return;
    }

    const team = await db.orgTeam.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new AppError(404, "Team not found");

    await db.orgTeam.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/org/teams/:id/members
teamsRouter.post("/:id/members", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId  = req.user!.orgId!;
    const { id } = req.params;

    if (migrationPending()) {
      res.status(503).json({ error: "Run database migration to enable Teams." });
      return;
    }

    const memberId = z.string().parse(req.body.memberId);

    const team = await db.orgTeam.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new AppError(404, "Team not found");

    const member = await prisma.orgMember.findFirst({ where: { id: memberId, organizationId: orgId } });
    if (!member) throw new AppError(400, "Member not in this organization");

    const tm = await db.orgTeamMember.create({
      data: { teamId: id, memberId },
      include: { member: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });

    res.status(201).json({ teamMember: tm });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, "memberId is required"));
    else next(err);
  }
});

// DELETE /api/org/teams/:id/members/:memberId
teamsRouter.delete("/:id/members/:memberId", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId              = req.user!.orgId!;
    const { id, memberId }   = req.params;

    if (migrationPending()) {
      res.status(503).json({ error: "Run database migration to enable Teams." });
      return;
    }

    const team = await db.orgTeam.findFirst({ where: { id, organizationId: orgId } });
    if (!team) throw new AppError(404, "Team not found");

    await db.orgTeamMember.deleteMany({ where: { teamId: id, memberId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});
