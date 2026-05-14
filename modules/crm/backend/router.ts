import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AppError, logActivity, requireRole, fireHook } from "@business360/module-sdk";

export const router = Router();

// Members are read-only; managers can create/edit/delete
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
  findFirst: (a: unknown) => Promise<unknown | null>;
  groupBy:   (a: unknown) => Promise<unknown[]>;
};

type CrmDb = {
  lead:       DbModel;
  deal:       DbModel;
  crmCompany: DbModel;
  crmContact: DbModel;
};

function db(req: Request): CrmDb {
  return req.tenantDb as unknown as CrmDb;
}

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
  name:     z.string().min(1),
  email:    z.string().email().optional().or(z.literal("")),
  phone:    z.string().optional(),
  industry: z.string().optional(),
  website:  z.string().optional(),
  address:  z.string().optional(),
  notes:    z.string().optional(),
});

const dealSchema = z.object({
  title:      z.string().min(1),
  value:      z.number().nonnegative().optional(),
  currency:   z.string().optional(),
  status:     z.enum(["prospect", "qualified", "proposal", "negotiation", "won", "lost"]).optional(),
  companyId:  z.string().optional(),
  assignedTo: z.string().optional(),
  closeDate:  z.string().datetime({ offset: true }).optional(),
  notes:      z.string().optional(),
});

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const d = db(req);
    const [
      totalLeads, totalDeals,
      leadsByStatus, dealsByStatus,
      totalCompanies, totalContacts,
    ] = await Promise.all([
      d.lead.count(),
      d.deal.count(),
      d.lead.groupBy({ by: ["status"], _count: { id: true } }),
      d.deal.groupBy({ by: ["status"], _count: { id: true }, _sum: { value: true } }),
      d.crmCompany.count(),
      d.crmContact.count(),
    ]);

    res.json({
      totalLeads, totalDeals, leadsByStatus, dealsByStatus,
      totalCompanies, totalContacts,
      totalCustomers: totalCompanies,
    });
  } catch (err) { next(err); }
});

// ─── Leads ───────────────────────────────────────────────────────────────────

router.get("/leads", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const skip   = (page - 1) * limit;
    const status = req.query["status"] as string | undefined;
    const where  = status ? { status } : {};

    const [leads, total] = await Promise.all([
      db(req).lead.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
      db(req).lead.count({ where }),
    ]);
    res.json({ leads, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/leads", async (req, res, next) => {
  try {
    const data = leadSchema.parse(req.body);
    const lead = await db(req).lead.create({ data: { ...data, email: data.email || null } }) as { id: string; name: string };
    void logActivity(req, "create_lead", "lead", lead.id, { name: lead.name });
    void fireHook(req, "lead.created", lead as Record<string, unknown>);
    res.status(201).json({ lead });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/leads/:id", async (req, res, next) => {
  try {
    const data = leadSchema.partial().parse(req.body);
    const lead = await db(req).lead.update({
      where: { id: req.params["id"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
    }) as { id: string };
    void logActivity(req, "update_lead", "lead", lead.id);
    void fireHook(req, "lead.updated", lead as Record<string, unknown>);
    res.json({ lead });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/leads/:id", async (req, res, next) => {
  try {
    const id = req.params["id"]!;
    await db(req).lead.delete({ where: { id } });
    void logActivity(req, "delete_lead", "lead", id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/leads/:id/convert", async (req, res, next) => {
  try {
    const d    = db(req);
    const lead = await d.lead.findUnique({ where: { id: req.params["id"]! } }) as {
      id: string; name: string; email: string | null; phone: string | null;
      company: string | null; notes: string | null; status: string;
    } | null;
    if (!lead) throw new AppError(404, "Lead not found");
    if (lead.status === "converted") throw new AppError(400, "Lead already converted");

    await d.lead.update({ where: { id: lead.id }, data: { status: "converted" } });

    const companyName = lead.company || lead.name;
    let company = await d.crmCompany.findFirst({
      where: { name: { equals: companyName, mode: "insensitive" } },
    }) as { id: string } | null;
    if (!company) {
      company = await d.crmCompany.create({
        data: {
          name:  companyName,
          email: !lead.company ? (lead.email || null) : null,
          phone: !lead.company ? (lead.phone || null) : null,
        },
      }) as { id: string };
    }

    const contact = await d.crmContact.create({
      data: {
        companyId: company.id,
        name:      lead.name,
        email:     lead.email || null,
        phone:     lead.phone || null,
      },
    });

    res.status(201).json({ customer: company, contact });
  } catch (err) { next(err); }
});

// ─── Customers (backed by CrmCompany — contacts module is the source of truth) ─

router.get("/customers", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const skip   = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    const where = search
      ? { OR: [
          { name:     { contains: search, mode: "insensitive" as const } },
          { email:    { contains: search, mode: "insensitive" as const } },
          { industry: { contains: search, mode: "insensitive" as const } },
        ] }
      : {};

    const [customers, total] = await Promise.all([
      db(req).crmCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          contacts: { orderBy: { createdAt: "asc" as const } },
          deals: { select: { id: true, title: true, status: true, value: true, currency: true } },
        },
      }),
      db(req).crmCompany.count({ where }),
    ]);
    res.json({ customers, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/customers", async (req, res, next) => {
  try {
    const data     = customerSchema.parse(req.body);
    const customer = await db(req).crmCompany.create({
      data: { ...data, email: data.email || null },
      include: { contacts: true, deals: true },
    });
    res.status(201).json({ customer });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/customers/:id", async (req, res, next) => {
  try {
    const data     = customerSchema.partial().parse(req.body);
    const customer = await db(req).crmCompany.update({
      where: { id: req.params["id"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
      include: { contacts: true, deals: true },
    });
    res.json({ customer });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/customers/:id", async (req, res, next) => {
  try {
    await db(req).crmCompany.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Deals ───────────────────────────────────────────────────────────────────

router.get("/deals", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "100"))));
    const skip   = (page - 1) * limit;
    const status = req.query["status"] as string | undefined;
    const where  = status ? { status } : {};

    const [deals, total] = await Promise.all([
      db(req).deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { company: { select: { id: true, name: true, industry: true } } },
      }),
      db(req).deal.count({ where }),
    ]);
    res.json({ deals, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/deals", async (req, res, next) => {
  try {
    const data = dealSchema.parse(req.body);
    const deal = await db(req).deal.create({
      data: {
        ...data,
        currency:  data.currency ?? req.orgCurrency ?? "USD",
        closeDate: data.closeDate ? new Date(data.closeDate) : null,
      },
      include: { company: { select: { id: true, name: true, industry: true } } },
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
    const deal = await db(req).deal.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        closeDate: data.closeDate !== undefined ? (data.closeDate ? new Date(data.closeDate) : null) : undefined,
      },
      include: { company: { select: { id: true, name: true, industry: true } } },
    });
    res.json({ deal });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/deals/:id", async (req, res, next) => {
  try {
    await db(req).deal.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/crm/export — download all leads as CSV
router.get("/export", requireRole("member"), async (req, res, next) => {
  try {
    const tenantDb = req.tenantDb as any;
    const rows = await tenantDb.lead.findMany({ orderBy: { createdAt: "desc" } });

    if (!rows.length) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="leads.csv"`);
      return res.send("id,name,email,phone,company,status,source,notes,assignedTo,createdAt,updatedAt\n");
    }

    const headers = Object.keys(rows[0]).filter((k: string) => !["passwordHash", "totpSecret"].includes(k));
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v instanceof Date ? v.toISOString() : v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r: Record<string, unknown>) => headers.map((h: string) => escape(r[h])).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="leads.csv"`);
    res.send(csv);
  } catch (err) { next(err); }
});

// DELETE /api/crm/bulk — delete multiple leads by IDs
router.delete("/bulk", requireRole("manager"), async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).min(1).max(100) }).parse(req.body);
    const tenantDb = req.tenantDb as any;
    const { count } = await tenantDb.lead.deleteMany({ where: { id: { in: ids } } });
    res.json({ deleted: count });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(400, err.message));
    next(err);
  }
});
