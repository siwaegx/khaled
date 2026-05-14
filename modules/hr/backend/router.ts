import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AppError, requireRole } from "@business360/module-sdk";

export const router = Router();

type DbModel = {
  findMany:  (a: unknown) => Promise<unknown[]>;
  count:     (a?: unknown) => Promise<number>;
  create:    (a: unknown) => Promise<unknown>;
  update:    (a: unknown) => Promise<unknown>;
  delete:    (a: unknown) => Promise<unknown>;
  groupBy:   (a: unknown) => Promise<unknown[]>;
};

type HrDb = {
  employee:     DbModel;
  leaveRequest: DbModel;
};

function db(req: Request): HrDb {
  return req.tenantDb as unknown as HrDb;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name:            z.string().min(1),
  email:           z.string().email().optional().or(z.literal("")).optional(),
  phone:           z.string().optional(),
  position:        z.string().optional(),
  department:      z.string().optional(),
  salary:          z.number().min(0).optional(),
  status:          z.enum(["active", "inactive", "terminated"]).optional(),
  hireDate:        z.string().optional(),
  terminationDate: z.string().optional(),
  notes:           z.string().optional(),
});

const patchEmployeeSchema = employeeSchema.partial();

const leaveSchema = z.object({
  employeeId: z.string().min(1),
  type:       z.enum(["annual", "sick", "maternity", "paternity", "unpaid"]),
  startDate:  z.string().min(1),
  endDate:    z.string().min(1),
  days:       z.number().int().min(1),
  reason:     z.string().optional(),
  notes:      z.string().optional(),
});

const patchLeaveSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const d = db(req);
    const [totalEmployees, totalLeaveRequests, employeesByStatus, leaveByType] = await Promise.all([
      d.employee.count(),
      d.leaveRequest.count(),
      d.employee.groupBy({ by: ["status"], _count: { id: true } }),
      d.leaveRequest.groupBy({ by: ["type"], _count: { id: true }, _sum: { days: true } }),
    ]);

    const byStatus = employeesByStatus as Array<{ status: string; _count: { id: number } }>;
    const activeCount = byStatus.find((r) => r.status === "active")?._count?.id ?? 0;

    res.json({ totalEmployees, totalLeaveRequests, activeCount, employeesByStatus: byStatus, leaveByType });
  } catch (err) { next(err); }
});

// ─── Employees ────────────────────────────────────────────────────────────────

router.get("/employees", async (req, res, next) => {
  try {
    const d = db(req);
    const { status, department, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = {};
    if (status)     where.status     = status;
    if (department) where.department = department;

    const [employees, total] = await Promise.all([
      d.employee.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: "desc" }, include: { _count: { select: { leaveRequests: true } } } }),
      d.employee.count({ where }),
    ]);

    res.json({ employees, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

router.post("/employees", async (req, res, next) => {
  try {
    const data = employeeSchema.parse(req.body);
    const employee = await db(req).employee.create({ data });
    res.status(201).json({ employee });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.issues?.[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/employees/:id", async (req, res, next) => {
  try {
    const data = patchEmployeeSchema.parse(req.body);
    const employee = await db(req).employee.update({ where: { id: req.params.id }, data });
    res.json({ employee });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.issues?.[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/employees/:id", async (req, res, next) => {
  try {
    await db(req).employee.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Leave Requests ───────────────────────────────────────────────────────────

router.get("/leave", async (req, res, next) => {
  try {
    const d = db(req);
    const { employeeId, status, page = "1", limit = "20" } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where: Record<string, unknown> = {};
    if (employeeId) where.employeeId = employeeId;
    if (status)     where.status     = status;

    const [requests, total] = await Promise.all([
      d.leaveRequest.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: "desc" }, include: { employee: { select: { id: true, name: true, department: true } } } }),
      d.leaveRequest.count({ where }),
    ]);

    res.json({ requests, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

router.post("/leave", async (req, res, next) => {
  try {
    const data = leaveSchema.parse(req.body);
    const request = await db(req).leaveRequest.create({ data });
    res.status(201).json({ request });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.issues?.[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/leave/:id", async (req, res, next) => {
  try {
    const { status } = patchLeaveSchema.parse(req.body);
    const request = await db(req).leaveRequest.update({ where: { id: req.params.id }, data: { status } });
    res.json({ request });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.issues?.[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/leave/:id", async (req, res, next) => {
  try {
    await db(req).leaveRequest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/hr/export — download all employees as CSV
router.get("/export", requireRole("member"), async (req, res, next) => {
  try {
    const tenantDb = req.tenantDb as any;
    const rows = await tenantDb.employee.findMany({ orderBy: { createdAt: "desc" } });

    if (!rows.length) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="employees.csv"`);
      return res.send("id,name,email,phone,position,department,salary,status,hireDate,terminationDate,notes,createdAt,updatedAt\n");
    }

    const headers = Object.keys(rows[0]).filter((k: string) => !["passwordHash", "totpSecret"].includes(k));
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v instanceof Date ? v.toISOString() : v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r: Record<string, unknown>) => headers.map((h: string) => escape(r[h])).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="employees.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// DELETE /api/hr/bulk — delete multiple employees by IDs
router.delete("/bulk", requireRole("manager"), async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const tenantDb = req.tenantDb as any;
    const { count } = await tenantDb.employee.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: count });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, err.message));
    next(err);
  }
});
