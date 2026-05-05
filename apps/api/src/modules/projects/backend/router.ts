import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../middleware/errorHandler";

export const router = Router();

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
    const db = req.tenantDb!;
    const [totalProjects, totalTasks, projectsByStatus, tasksByStatus] = await Promise.all([
      db.project.count(),
      db.task.count(),
      db.project.groupBy({ by: ["status"], _count: { id: true } }),
      db.task.groupBy({ by: ["status"], _count: { id: true } }),
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
    const where  = status ? { status: status as "planning" | "active" | "on_hold" | "completed" | "cancelled" } : {};
    const [projects, total] = await Promise.all([
      req.tenantDb!.project.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { tasks: true } } },
      }),
      req.tenantDb!.project.count({ where }),
    ]);
    res.json({ projects, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/projects", async (req, res, next) => {
  try {
    const data = projectSchema.parse(req.body);
    const project = await req.tenantDb!.project.create({
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate:   data.endDate   ? new Date(data.endDate)   : undefined,
      },
    });
    res.status(201).json({ project });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/projects/:id", async (req, res, next) => {
  try {
    const data = projectSchema.partial().parse(req.body);
    const project = await req.tenantDb!.project.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        startDate: data.startDate !== undefined ? (data.startDate ? new Date(data.startDate) : null) : undefined,
        endDate:   data.endDate   !== undefined ? (data.endDate   ? new Date(data.endDate)   : null) : undefined,
      },
    });
    res.json({ project });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/projects/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.project.delete({ where: { id: req.params["id"]! } });
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
      req.tenantDb!.task.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        include: { project: { select: { id: true, name: true } } },
      }),
      req.tenantDb!.task.count({ where }),
    ]);
    res.json({ tasks, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/tasks", async (req, res, next) => {
  try {
    const data = taskSchema.parse(req.body);
    const task = await req.tenantDb!.task.create({
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
    res.status(201).json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/tasks/:id", async (req, res, next) => {
  try {
    const data = taskSchema.partial().parse(req.body);
    const task = await req.tenantDb!.task.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      },
    });
    res.json({ task });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/tasks/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.task.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
