import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../middleware/errorHandler";

export const router = Router();

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
    const db = req.tenantDb!;
    const [totalInvoices, totalExpenses, invoicesByStatus, expensesByCategory] = await Promise.all([
      db.invoice.count(),
      db.expense.count(),
      db.invoice.groupBy({ by: ["status"], _count: { id: true }, _sum: { total: true } }),
      db.expense.groupBy({ by: ["category"], _count: { id: true }, _sum: { amount: true } }),
    ]);
    const paidTotal = invoicesByStatus.find(s => s.status === "paid")?._sum?.total ?? 0;
    const outstandingTotal = invoicesByStatus
      .filter(s => s.status === "sent" || s.status === "overdue")
      .reduce((acc, s) => acc + (s._sum?.total ?? 0), 0);
    res.json({ totalInvoices, totalExpenses, paidTotal, outstandingTotal, invoicesByStatus, expensesByCategory });
  } catch (err) { next(err); }
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

router.get("/invoices", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1")));
    const limit  = Math.min(100, Math.max(1, parseInt(String(req.query["limit"]  ?? "20"))));
    const status = req.query["status"] as string | undefined;
    const where  = status ? { status: status as "draft" | "sent" | "paid" | "overdue" | "cancelled" } : {};
    const [invoices, total] = await Promise.all([
      req.tenantDb!.invoice.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      req.tenantDb!.invoice.count({ where }),
    ]);
    res.json({ invoices, total, page, limit });
  } catch (err) { next(err); }
});

router.get("/invoices/:id", async (req, res, next) => {
  try {
    const invoice = await req.tenantDb!.invoice.findUnique({
      where: { id: req.params["id"]! },
      include: { items: true },
    });
    if (!invoice) throw new AppError(404, "Invoice not found");
    res.json({ invoice });
  } catch (err) { next(err); }
});

router.post("/invoices", async (req, res, next) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const invoice = await req.tenantDb!.invoice.create({
      data: {
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        dueDate:   data.dueDate   ? new Date(data.dueDate)   : undefined,
        paidDate:  data.paidDate  ? new Date(data.paidDate)  : undefined,
      },
    });
    res.status(201).json({ invoice });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/invoices/:id", async (req, res, next) => {
  try {
    const data = invoiceSchema.partial().parse(req.body);
    const invoice = await req.tenantDb!.invoice.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        dueDate:   data.dueDate   !== undefined ? (data.dueDate   ? new Date(data.dueDate)   : null) : undefined,
        paidDate:  data.paidDate  !== undefined ? (data.paidDate  ? new Date(data.paidDate)  : null) : undefined,
      },
    });
    res.json({ invoice });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/invoices/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.invoice.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Invoice Items ─────────────────────────────────────────────────────────────

router.post("/invoices/:id/items", async (req, res, next) => {
  try {
    const data = invoiceItemSchema.parse(req.body);
    const item = await req.tenantDb!.invoiceItem.create({
      data: { ...data, invoiceId: req.params["id"]! },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/invoices/:id/items/:itemId", async (req, res, next) => {
  try {
    await req.tenantDb!.invoiceItem.delete({ where: { id: req.params["itemId"]! } });
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
      req.tenantDb!.expense.findMany({
        where,
        skip: (page - 1) * limit, take: limit,
        orderBy: { date: "desc" },
      }),
      req.tenantDb!.expense.count({ where }),
    ]);
    res.json({ expenses, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/expenses", async (req, res, next) => {
  try {
    const data = expenseSchema.parse(req.body);
    const expense = await req.tenantDb!.expense.create({
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.status(201).json({ expense });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/expenses/:id", async (req, res, next) => {
  try {
    const data = expenseSchema.partial().parse(req.body);
    const expense = await req.tenantDb!.expense.update({
      where: { id: req.params["id"]! },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.json({ expense });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/expenses/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.expense.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
