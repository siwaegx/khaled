import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const dashboardConfigRouter = Router();
dashboardConfigRouter.use(requireAuth);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const widgetSchema = z.object({
  key:     z.string().min(1),
  visible: z.boolean(),
  order:   z.number().int().min(0),
});

const configSchema = z.object({
  widgets: z.array(widgetSchema),
});

// GET /api/dashboard/config
dashboardConfigRouter.get("/config", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No active organization");

    let config = null;
    try {
      const org = await db.organization.findUnique({
        where: { id: orgId },
        select: { dashboardConfig: true },
      });
      config = org?.dashboardConfig ?? null;
    } catch { /* migration pending */ }

    res.json({ config });
  } catch (err) { next(err); }
});

// PUT /api/dashboard/config — any authenticated org member can save layout
dashboardConfigRouter.put("/config", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const data = configSchema.parse(req.body);

    try {
      await db.organization.update({
        where: { id: orgId },
        data:  { dashboardConfig: data },
      });
    } catch {
      res.status(503).json({ error: "Run database migration to enable Dashboard Config." });
      return;
    }

    res.json({ ok: true, config: data });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});
