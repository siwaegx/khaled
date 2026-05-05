import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../middleware/errorHandler";

export const router = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const leadSchema = z.object({
  name:       z.string().min(1),
  email:      z.string().email().optional().or(z.literal("")),
  phone:      z.string().optional(),
  company:    z.string().optional(),
  status:     z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional(),
  source:     z.string().optional(),
  notes:      z.string().optional(),
  assignedTo: z.string().optional(),
});

const customerSchema = z.object({
  name:    z.string().min(1),
  email:   z.string().email().optional().or(z.literal("")),
  phone:   z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  notes:   z.string().optional(),
});

const dealSchema = z.object({
  title:      z.string().min(1),
  value:      z.number().nonnegative().optional(),
  currency:   z.string().default("USD"),
  status:     z.enum(["prospect", "qualified", "proposal", "negotiation", "won", "lost"]).optional(),
  customerId: z.string().optional(),
  assignedTo: z.string().optional(),
  closeDate:  z.string().datetime({ offset: true }).optional(),
  notes:      z.string().optional(),
});

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const db = req.tenantDb!;
    const [
      totalLeads, totalCustomers, totalDeals,
      leadsByStatus, dealsByStatus,
    ] = await Promise.all([
      db.lead.count(),
      db.customer.count(),
      db.deal.count(),
      db.lead.groupBy({ by: ["status"], _count: { id: true } }),
      db.deal.groupBy({ by: ["status"], _count: { id: true }, _sum: { value: true } }),
    ]);

    res.json({ totalLeads, totalCustomers, totalDeals, leadsByStatus, dealsByStatus });
  } catch (err) { next(err); }
});

// ─── Leads ───────────────────────────────────────────────────────────────────

router.get("/leads", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"]  ?? "50"))));
    const skip   = (page - 1) * limit;
    const status = req.query["status"] as string | undefined;

    const where = status ? { status: status as "new" | "contacted" | "qualified" | "converted" | "lost" } : {};

    const [leads, total] = await Promise.all([
      req.tenantDb!.lead.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      req.tenantDb!.lead.count({ where }),
    ]);
    res.json({ leads, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/leads", async (req, res, next) => {
  try {
    const data = leadSchema.parse(req.body);
    const lead = await req.tenantDb!.lead.create({ data: { ...data, email: data.email || null } });
    res.status(201).json({ lead });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/leads/:id", async (req, res, next) => {
  try {
    const data = leadSchema.partial().parse(req.body);
    const lead = await req.tenantDb!.lead.update({
      where: { id: req.params["id"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
    });
    res.json({ lead });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/leads/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.lead.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/leads/:id/convert", async (req, res, next) => {
  try {
    const db   = req.tenantDb!;
    const lead = await db.lead.findUnique({ where: { id: req.params["id"]! } });
    if (!lead) throw new AppError(404, "Lead not found");
    if (lead.status === "converted") throw new AppError(400, "Lead already converted");

    const [customer] = await Promise.all([
      db.customer.create({
        data: {
          name:    lead.name,
          email:   lead.email   || null,
          phone:   lead.phone   || null,
          company: lead.company || null,
          notes:   lead.notes   || null,
        },
      }),
      db.lead.update({ where: { id: lead.id }, data: { status: "converted" } }),
    ]);
    res.status(201).json({ customer });
  } catch (err) { next(err); }
});

// ─── Customers ───────────────────────────────────────────────────────────────

router.get("/customers", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const skip  = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      req.tenantDb!.customer.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { deals: { select: { id: true, title: true, status: true, value: true } } },
      }),
      req.tenantDb!.customer.count(),
    ]);
    res.json({ customers, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/customers", async (req, res, next) => {
  try {
    const data = customerSchema.parse(req.body);
    const customer = await req.tenantDb!.customer.create({ data: { ...data, email: data.email || null } });
    res.status(201).json({ customer });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/customers/:id", async (req, res, next) => {
  try {
    const data = customerSchema.partial().parse(req.body);
    const customer = await req.tenantDb!.customer.update({
      where: { id: req.params["id"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
    });
    res.json({ customer });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/customers/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.customer.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Deals ───────────────────────────────────────────────────────────────────

router.get("/deals", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]   ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"]  ?? "100"))));
    const skip   = (page - 1) * limit;
    const status = req.query["status"] as string | undefined;

    const where = status ? { status: status as "prospect" | "qualified" | "proposal" | "negotiation" | "won" | "lost" } : {};

    const [deals, total] = await Promise.all([
      req.tenantDb!.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { customer: { select: { id: true, name: true, company: true } } },
      }),
      req.tenantDb!.deal.count({ where }),
    ]);
    res.json({ deals, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/deals", async (req, res, next) => {
  try {
    const data = dealSchema.parse(req.body);
    const deal = await req.tenantDb!.deal.create({
      data: {
        ...data,
        closeDate: data.closeDate ? new Date(data.closeDate) : null,
      },
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.status(201).json({ deal });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/deals/:id", async (req, res, next) => {
  try {
    const data = dealSchema.partial().parse(req.body);
    const deal = await req.tenantDb!.deal.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        closeDate: data.closeDate !== undefined ? (data.closeDate ? new Date(data.closeDate) : null) : undefined,
      },
      include: { customer: { select: { id: true, name: true, company: true } } },
    });
    res.json({ deal });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/deals/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.deal.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
