import { Router } from "express";
import { z } from "zod";
import { AppError, requireRole, logActivity, fireHook } from "@business360/module-sdk";

export const router = Router();

type CalendarDb = {
  calendarEvent: {
    findMany: (args: unknown) => Promise<unknown[]>;
    findUnique: (args: unknown) => Promise<unknown | null>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
  };
};

function getDb(req: { tenantDb: unknown }): CalendarDb {
  return req.tenantDb as CalendarDb;
}

const EVENT_TYPES = ["meeting", "deadline", "reminder", "task", "other"] as const;

const createEventSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  startAt:     z.string().datetime(),
  endAt:       z.string().datetime(),
  allDay:      z.boolean().default(false),
  type:        z.enum(EVENT_TYPES).default("meeting"),
  entityType:  z.string().optional(),
  entityId:    z.string().optional(),
  color:       z.string().max(20).optional(),
});

const patchEventSchema = createEventSchema.partial();

// GET /api/module/calendar/events?from=ISO&to=ISO
router.get("/events", async (req, res, next) => {
  try {
    const { from, to } = z.object({
      from: z.string().datetime().optional(),
      to:   z.string().datetime().optional(),
    }).parse(req.query);

    const db = getDb(req);
    const where: Record<string, unknown> = {};
    if (from || to) {
      where.startAt = {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to)   }),
      };
    }

    const events = await db.calendarEvent.findMany({
      where,
      orderBy: [{ startAt: "asc" }],
    });

    res.json({ events });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});

// POST /api/module/calendar/events
router.post("/events", requireRole("manager"), async (req, res, next) => {
  try {
    const data = createEventSchema.parse(req.body);
    const db = getDb(req);

    if (new Date(data.startAt) > new Date(data.endAt)) {
      throw new AppError(400, "startAt must be before endAt");
    }

    const event = await db.calendarEvent.create({
      data: {
        ...data,
        startAt:   new Date(data.startAt),
        endAt:     new Date(data.endAt),
        createdBy: req.user!.userId,
      },
    });

    await logActivity(req, "create", "calendarEvent", (event as { id: string }).id);
    void fireHook(req, "calendar.created", event as Record<string, unknown>);
    res.status(201).json({ event });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});

// PATCH /api/module/calendar/events/:id
router.patch("/events/:id", requireRole("manager"), async (req, res, next) => {
  try {
    const db = getDb(req);
    const existing = await db.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Event not found");

    const data = patchEventSchema.parse(req.body);
    const updateData: Record<string, unknown> = { ...data };
    if (data.startAt) updateData.startAt = new Date(data.startAt);
    if (data.endAt)   updateData.endAt   = new Date(data.endAt);

    const event = await db.calendarEvent.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logActivity(req, "update", "calendarEvent", req.params.id);
    res.json({ event });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});

// DELETE /api/module/calendar/events/:id
router.delete("/events/:id", requireRole("manager"), async (req, res, next) => {
  try {
    const db = getDb(req);
    const existing = await db.calendarEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Event not found");

    await db.calendarEvent.delete({ where: { id: req.params.id } });
    await logActivity(req, "delete", "calendarEvent", req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/calendar/export — download all calendar events as CSV
router.get("/export", requireRole("member"), async (req, res, next) => {
  try {
    const tenantDb = req.tenantDb as any;
    const rows = await tenantDb.calendarEvent.findMany({ orderBy: { createdAt: "desc" } });

    if (!rows.length) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="calendar-events.csv"`);
      return res.send("id,title,description,startAt,endAt,allDay,type,entityType,entityId,color,createdBy,createdAt,updatedAt\n");
    }

    const headers = Object.keys(rows[0]).filter((k: string) => !["passwordHash", "totpSecret"].includes(k));
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v instanceof Date ? v.toISOString() : v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r: Record<string, unknown>) => headers.map((h: string) => escape(r[h])).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="calendar-events.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// DELETE /api/calendar/bulk — delete multiple calendar events by IDs
router.delete("/bulk", requireRole("manager"), async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const tenantDb = req.tenantDb as any;
    const { count } = await tenantDb.calendarEvent.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: count });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, err.message));
    next(err);
  }
});

