import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const moduleAccessRouter = Router();
moduleAccessRouter.use(requireAuth);

// GET /api/org/module-access
// Returns { moduleAccess: { [moduleKey]: { [role]: boolean } } }
moduleAccessRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No active organization");
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { moduleAccess: true },
    });
    res.json({ moduleAccess: org?.moduleAccess ?? {} });
  } catch (err) {
    next(err);
  }
});

// Accepts a map of moduleKey → { [role]: boolean } for any role names
const accessSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

// PUT /api/org/module-access — owner-only
moduleAccessRouter.put("/", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const moduleAccess = accessSchema.parse(req.body.moduleAccess);
    await prisma.organization.update({
      where: { id: orgId },
      data: { moduleAccess },
    });
    res.json({ ok: true, moduleAccess });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});
