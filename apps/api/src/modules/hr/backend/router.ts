import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../middleware/errorHandler";

export const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name:            z.string().min(1),
  email:           z.string().email().optional(),
  phone:           z.string().optional(),
  position:        z.string().optional(),
  department:      z.string().optional(),
  salary:          z.number().nonnegative().optional(),
  status:          z.enum(["active", "inactive", "terminated"]).optional(),
  hireDate:        z.string().datetime({ offset: true }).optional(),
  terminationDate: z.string().datetime({ offset: true }).optional(),
  notes:           z.string().optional(),
});

const leaveRequestSchema = z.object({
  employeeId: z.string().min(1),
  type:       z.enum(["annual", "sick", "unpaid", "maternity", "paternity", "other"]),
  status:     z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  startDate:  z.string().datetime({ offset: true }),
  endDate:    z.string().datetime({ offset: true }),
  days:       z.number().positive(),
  reason:     z.string().optional(),
  notes:      z.string().optional(),
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const db = req.tenantDb!;
    const [totalEmployees, totalLeaveRequests, employeesByStatus, leaveByType] = await Promise.all([
      db.employee.count(),
      db.leaveRequest.count(),
      db.employee.groupBy({ by: ["status"], _count: { id: true } }),
      db.leaveRequest.groupBy({ by: ["type"], _count: { id: true }, _sum: { days: true } }),
    ]);
    const activeCount = employeesByStatus.find(s => s.status === "active")?._count?.id ?? 0;
    res.json({ totalEmployees, totalLeaveRequests, activeCount, employeesByStatus, leaveByType });
  } catch (err) { next(err); }
});

// ─── Employees ────────────────────────────────────────────────────────────────

router.get("/employees", async (req, res, next) => {
  try {
    const page       = Math.max(1, parseInt(String(req.query["page"]       ?? "1")));
    const limit      = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]      ?? "20"))));
    const status     = req.query["status"]     as string | undefined;
    const department = req.query["department"] as string | undefined;
    const where: Record<string, unknown> = {};
    if (status)     where["status"]     = status;
    if (department) where["department"] = department;
    const [employees, total] = await Promise.all([
      req.tenantDb!.employee.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { name: "asc" },
        include: { _count: { select: { leaveRequests: true } } },
      }),
      req.tenantDb!.employee.count({ where }),
    ]);
    res.json({ employees, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/employees", async (req, res, next) => {
  try {
    const data = employeeSchema.parse(req.body);
    const employee = await req.tenantDb!.employee.create({
      data: {
        ...data,
        hireDate:        data.hireDate        ? new Date(data.hireDate)        : undefined,
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : undefined,
      },
    });
    res.status(201).json({ employee });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/employees/:id", async (req, res, next) => {
  try {
    const data = employeeSchema.partial().parse(req.body);
    const employee = await req.tenantDb!.employee.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        hireDate:        data.hireDate        !== undefined ? (data.hireDate        ? new Date(data.hireDate)        : null) : undefined,
        terminationDate: data.terminationDate !== undefined ? (data.terminationDate ? new Date(data.terminationDate) : null) : undefined,
      },
    });
    res.json({ employee });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/employees/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.employee.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Leave Requests ───────────────────────────────────────────────────────────

router.get("/leave", async (req, res, next) => {
  try {
    const page       = Math.max(1, parseInt(String(req.query["page"]       ?? "1")));
    const limit      = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]      ?? "20"))));
    const employeeId = req.query["employeeId"] as string | undefined;
    const status     = req.query["status"]     as string | undefined;
    const where: Record<string, unknown> = {};
    if (employeeId) where["employeeId"] = employeeId;
    if (status)     where["status"]     = status;
    const [requests, total] = await Promise.all([
      req.tenantDb!.leaveRequest.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { id: true, name: true, department: true } } },
      }),
      req.tenantDb!.leaveRequest.count({ where }),
    ]);
    res.json({ requests, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/leave", async (req, res, next) => {
  try {
    const data = leaveRequestSchema.parse(req.body);
    const request = await req.tenantDb!.leaveRequest.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate:   new Date(data.endDate),
      },
    });
    res.status(201).json({ request });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/leave/:id", async (req, res, next) => {
  try {
    const data = leaveRequestSchema.partial().parse(req.body);
    const request = await req.tenantDb!.leaveRequest.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate:   data.endDate   ? new Date(data.endDate)   : undefined,
      },
    });
    res.json({ request });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/leave/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.leaveRequest.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
