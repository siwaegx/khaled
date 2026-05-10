import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AppError, requireRole } from "@business360/module-sdk";

export const router = Router();

// All members can read and write tasks; only managers can manage projects
router.use((req, _res, next) => {
  const isProjectMutation = req.method !== "GET" && (req.path === "/projects" || /^\/projects\/[^/]+$/.test(req.path));
  if (isProjectMutation) return requireRole("manager")(req, _res, next);
  next();
});

// ─── DB helper ───────────────────────────────────────────────────────────────

type DbModel = {
  findMany:  (a: unknown) => Promise<unknown[]>;
  count:     (a?: unknown) => Promise<number>;
  create:    (a: unknown) => Promise<unknown>;
  update:    (a: unknown) => Promise<unknown>;
  delete:    (a: unknown) => Promise<unknown>;
  findUnique:(a: unknown) => Promise<unknown | null>;
  groupBy:   (a: unknown) => Promise<unknown[]>;
};

type ProjDb = {
  project: DbModel;
  task:    DbModel;
};

function db(req: Request): ProjDb {
  return req.tenantDb as unknown as ProjDb;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const projectSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  status:      z.enum(["planning", "active", "on_hold", "completed", "cancelled"]).optional(),
  startDate:   z.string().datetime({ offset: true }).optional(),
  endDate:     z.string().datetime({ offset: true }).optional(),
});

const taskSchema = z.object({
  projectId:   z.string().optional(),
  title:       z.string().min(1),
  description: z.string().optional(),
  status:      z.enum(["todo", "in_progress", "review", "done", "cancelled"]).optional(),
  priority:    z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo:  z.string().optional(),
  dueDate:     z.string().datetime({ offset: true }).optional(),
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const d = db(req);
    const [totalProjects, totalTasks, projectsByStatus, tasksByStatus] = await Promise.all([
      d.project.count(),
      d.task.count(),
      d.project.groupBy({ by: ["status"], _count: { id: true } }),
      d.task.groupBy({ by: ["status"], _count: { id: true } }),
    ]);
    res.json({ totalProjects, totalTasks, projectsByStatus, tasksByStatus });
  } catch (err) { next(err); }
});

// ─── Projects ─────────────────────────────────────────────────────────────────

router.get("/projects", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1")));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]  ?? "20"))));
    const status = req.query["status"] as string | undefined;
    const where  = status ? { status } : {};
    const [projects, total] = await Promise.all([
      db(req).project.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { tasks: true } } },
      }),
      db(req).project.count({ where }),
    ]);
    res.json({ projects, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/projects", async (req, res, next) => {
  try {
    const data    = projectSchema.parse(req.body);
    const project = await db(req).project.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate:   data.endDate   ? new Date(data.endDate)   : undefined,
      },
    });
    res.status(201).json({ project });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/projects/:id", async (req, res, next) => {
  try {
    const data    = projectSchema.partial().parse(req.body);
    const project = await db(req).project.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
        endDate:   data.endDate   !== undefined ? (data.endDate   ? new Date(data.endDate)   : null) : undefined,
      },
    });
    res.json({ project });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/projects/:id", async (req, res, next) => {
  try {
    await db(req).project.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

router.get("/tasks", async (req, res, next) => {
  try {
    const page      = Math.max(1, parseInt(String(req.query["page"]      ?? "1")));
    const limit     = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]     ?? "20"))));
    const projectId = req.query["projectId"] as string | undefined;
    const status    = req.query["status"]    as string | undefined;
    const priority  = req.query["priority"]  as string | undefined;
    const where: Record<string, unknown> = {};
    if (projectId) where["projectId"] = projectId;
    if (status)    where["status"]    = status;
    if (priority)  where["priority"]  = priority;
    const [tasks, total] = await Promise.all([
      db(req).task.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        include: { project: { select: { id: true, name: true } } },
      }),
      db(req).task.count({ where }),
    ]);
    res.json({ tasks, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const data = taskSchema.parse(req.body);
    const task = await db(req).task.create({
      data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    });
    res.status(201).json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/tasks/:id", async (req, res, next) => {
  try {
    const data = taskSchema.partial().parse(req.body);
    const task = await db(req).task.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      },
    });
    res.json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/tasks/:id", async (req, res, next) => {
  try {
    await db(req).task.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
