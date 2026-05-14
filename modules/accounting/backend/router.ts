import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AppError, requireRole, toNum } from "@business360/module-sdk";

export const router = Router();

// Members are read-only; managers can mutate
router.use((req, _res, next) => {
  if (req.method !== "GET") return requireRole("manager")(req, _res, next);
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

type AccDb = {
  invoice:     DbModel;
  invoiceItem: DbModel;
  expense:     DbModel;
};

function db(req: Request): AccDb {
  return req.tenantDb as unknown as AccDb;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const invoiceSchema = z.object({
  number:       z.string().min(1),
  customerName: z.string().min(1),
  customerId:   z.string().optional(),
  status:       z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).optional(),
  subtotal:     z.number().nonnegative().optional(),
  tax:          z.number().nonnegative().optional(),
  total:        z.number().nonnegative().optional(),
  notes:        z.string().optional(),
  issueDate:    z.string().datetime({ offset: true }).optional(),
  dueDate:      z.string().datetime({ offset: true }).optional(),
  paidDate:     z.string().datetime({ offset: true }).optional(),
});

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity:    z.number().positive(),
  unitPrice:   z.number().nonnegative(),
  amount:      z.number().nonnegative(),
});

const expenseSchema = z.object({
  category:    z.string().min(1),
  description: z.string().min(1),
  amount:      z.number().positive(),
  currency:    z.string().optional(),
  date:        z.string().datetime({ offset: true }).optional(),
  reference:   z.string().optional(),
  notes:       z.string().optional(),
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const d = db(req);
    const [totalInvoices, totalExpenses, invoicesByStatus, expensesByCategory] = await Promise.all([
      d.invoice.count(),
      d.expense.count(),
      d.invoice.groupBy({ by: ["status"], _count: { id: true }, _sum: { total: true } }),
      d.expense.groupBy({ by: ["category"], _count: { id: true }, _sum: { amount: true } }),
    ]);
    const rows = invoicesByStatus as { status: string; _sum: { total: unknown } }[];
    const paidTotal       = toNum(rows.find((s) => s.status === "paid")?._sum?.total);
    const outstandingTotal = rows
      .filter((s) => s.status === "sent" || s.status === "overdue")
      .reduce((acc, s) => acc + toNum(s._sum?.total), 0);
    res.json({ totalInvoices, totalExpenses, paidTotal, outstandingTotal, invoicesByStatus, expensesByCategory });
  } catch (err) { next(err); }
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

router.get("/invoices", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1")));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]  ?? "20"))));
    const status = req.query["status"] as string | undefined;
    const where  = status ? { status } : {};
    const [invoices, total] = await Promise.all([
      db(req).invoice.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      db(req).invoice.count({ where }),
    ]);
    res.json({ invoices, total, page, limit });
  } catch (err) { next(err); }
});

router.get("/invoices/:id", async (req, res, next) => {
  try {
    const invoice = await db(req).invoice.findUnique({
      where:   { id: req.params["id"]! },
      include: { items: true },
    });
    if (!invoice) throw new AppError(404, "Invoice not found");
    res.json({ invoice });
  } catch (err) { next(err); }
});

router.post("/invoices", async (req, res, next) => {
  try {
    const data    = invoiceSchema.parse(req.body);
    const invoice = await db(req).invoice.create({
      data: {
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        dueDate:   data.dueDate   ? new Date(data.dueDate)   : undefined,
        paidDate:  data.paidDate  ? new Date(data.paidDate)  : undefined,
      },
    });
    res.status(201).json({ invoice });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/invoices/:id", async (req, res, next) => {
  try {
    const data    = invoiceSchema.partial().parse(req.body);
    const invoice = await db(req).invoice.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        dueDate:   data.dueDate  !== undefined ? (data.dueDate  ? new Date(data.dueDate)  : null) : undefined,
        paidDate:  data.paidDate !== undefined ? (data.paidDate ? new Date(data.paidDate) : null) : undefined,
      },
    });
    res.json({ invoice });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/invoices/:id", async (req, res, next) => {
  try {
    await db(req).invoice.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/invoices/:id/items", async (req, res, next) => {
  try {
    const data = invoiceItemSchema.parse(req.body);
    const item = await db(req).invoiceItem.create({
      data: { ...data, invoiceId: req.params["id"]! },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/invoices/:id/items/:itemId", async (req, res, next) => {
  try {
    await db(req).invoiceItem.delete({ where: { id: req.params["itemId"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Expenses ─────────────────────────────────────────────────────────────────

router.get("/expenses", async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(String(req.query["page"]     ?? "1")));
    const limit    = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]    ?? "20"))));
    const category = req.query["category"] as string | undefined;
    const where    = category ? { category } : {};
    const [expenses, total] = await Promise.all([
      db(req).expense.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { date: "desc" },
      }),
      db(req).expense.count({ where }),
    ]);
    res.json({ expenses, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/expenses", async (req, res, next) => {
  try {
    const data    = expenseSchema.parse(req.body);
    const expense = await db(req).expense.create({
      data: {
        ...data,
        currency: data.currency ?? req.orgCurrency ?? "USD",
        date: data.date ? new Date(data.date) : undefined,
      },
    });
    res.status(201).json({ expense });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/expenses/:id", async (req, res, next) => {
  try {
    const data    = expenseSchema.partial().parse(req.body);
    const expense = await db(req).expense.update({
      where: { id: req.params["id"]! },
      data:  { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.json({ expense });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/expenses/:id", async (req, res, next) => {
  try {
    await db(req).expense.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/accounting/export — download all invoices as CSV
router.get("/export", requireRole("member"), async (req, res, next) => {
  try {
    const tenantDb = req.tenantDb as any;
    const rows = await tenantDb.invoice.findMany({ include: { items: true }, orderBy: { createdAt: "desc" } });

    if (!rows.length) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="invoices.csv"`);
      return res.send("id,number,customerName,customerId,status,subtotal,tax,total,notes,issueDate,dueDate,paidDate,itemCount,createdAt,updatedAt\n");
    }

    // Flatten: replace items array with itemCount
    const flatRows = (rows as Array<Record<string, unknown>>).map((r) => {
      const { items, ...rest } = r;
      return { ...rest, itemCount: Array.isArray(items) ? items.length : 0 };
    });

    const headers = Object.keys(flatRows[0]).filter((k: string) => !["passwordHash", "totpSecret"].includes(k));
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v instanceof Date ? v.toISOString() : v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...flatRows.map((r: Record<string, unknown>) => headers.map((h: string) => escape(r[h])).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="invoices.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// DELETE /api/accounting/bulk — delete multiple invoices by IDs
router.delete("/bulk", requireRole("manager"), async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const tenantDb = req.tenantDb as any;
    const { count } = await tenantDb.invoice.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: count });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, err.message));
    next(err);
  }
});
