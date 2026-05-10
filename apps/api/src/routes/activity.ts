import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";

export const activityRouter = Router();
activityRouter.use(requireAuth);

// GET /api/activity — paginated activity log for the org
activityRouter.get("/", async (req, res, next) => {
  try {
    const db = req.tenantDb as Record<string, {
      findMany: (args: unknown) => Promise<unknown[]>;
      count: (args?: unknown) => Promise<number>;
    }> | undefined;

    if (!db?.activityLog) throw new AppError(503, "Activity log not available for this organization");

    const page  = Math.max(1, parseInt(req.query["page"]  as string) || 1);
    const limit = Math.min(100, parseInt(req.query["limit"] as string) || 50);
    const entity = req.query["entity"] as string | undefined;
    const userId = req.query["userId"] as string | undefined;

    const where = {
      ...(entity ? { entity } : {}),
      ...(userId ? { userId } : {}),
    };

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.activityLog.count({ where }),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});
