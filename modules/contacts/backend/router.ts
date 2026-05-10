import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AppError, requireRole } from "@business360/module-sdk";

export const router = Router();

// Members read-only; managers can create/edit/delete
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
};

type ContactsDb = {
  crmCompany:    DbModel;
  crmContact:    DbModel;
  crmCompanyLog: DbModel;
};

function db(req: Request): ContactsDb {
  return req.tenantDb as unknown as ContactsDb;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const companySchema = z.object({
  name:     z.string().min(1),
  industry: z.string().optional(),
  website:  z.string().optional(),
  phone:    z.string().optional(),
  email:    z.string().email().optional().or(z.literal("")),
  address:  z.string().optional(),
  notes:    z.string().optional(),
});

const contactSchema = z.object({
  name:     z.string().min(1),
  position: z.string().optional(),
  email:    z.string().email().optional().or(z.literal("")),
  phone:    z.string().optional(),
  notes:    z.string().optional(),
});

const logSchema = z.object({
  type:     z.enum(["call", "visit", "email", "note", "other"]).default("note"),
  subject:  z.string().optional(),
  body:     z.string().optional(),
  loggedAt: z.string().datetime({ offset: true }).optional(),
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const [totalCompanies, totalContacts] = await Promise.all([
      db(req).crmCompany.count(),
      db(req).crmContact.count(),
    ]);
    res.json({ totalCompanies, totalContacts });
  } catch (err) { next(err); }
});

// ─── Companies ────────────────────────────────────────────────────────────────

router.get("/companies", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const skip   = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    const where = search
      ? { OR: [
          { name:     { contains: search, mode: "insensitive" as const } },
          { industry: { contains: search, mode: "insensitive" as const } },
          { email:    { contains: search, mode: "insensitive" as const } },
        ] }
      : {};

    const [companies, total] = await Promise.all([
      db(req).crmCompany.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { contacts: { orderBy: { createdAt: "asc" } } },
      }),
      db(req).crmCompany.count({ where }),
    ]);
    res.json({ companies, total, page, limit });
  } catch (err) { next(err); }
});

router.get("/companies/:id", async (req, res, next) => {
  try {
    const company = await db(req).crmCompany.findUnique({
      where: { id: req.params["id"]! },
      include: {
        contacts: { orderBy: { createdAt: "asc" } },
        logs:     { orderBy: { loggedAt: "desc" } },
      },
    });
    if (!company) throw new AppError(404, "Company not found");
    res.json({ company });
  } catch (err) { next(err); }
});

router.post("/companies", async (req, res, next) => {
  try {
    const data    = companySchema.parse(req.body);
    const company = await db(req).crmCompany.create({
      data: { ...data, email: data.email || null },
      include: { contacts: true },
    });
    res.status(201).json({ company });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/companies/:id", async (req, res, next) => {
  try {
    const data    = companySchema.partial().parse(req.body);
    const company = await db(req).crmCompany.update({
      where: { id: req.params["id"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
      include: { contacts: { orderBy: { createdAt: "asc" } } },
    });
    res.json({ company });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/companies/:id", async (req, res, next) => {
  try {
    await db(req).crmCompany.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Company logs ─────────────────────────────────────────────────────────────

router.get("/companies/:id/logs", async (req, res, next) => {
  try {
    const company = await db(req).crmCompany.findUnique({ where: { id: req.params["id"]! } });
    if (!company) throw new AppError(404, "Company not found");
    const logs = await db(req).crmCompanyLog.findMany({
      where:   { companyId: req.params["id"]! },
      orderBy: { loggedAt: "desc" },
    });
    res.json({ logs });
  } catch (err) { next(err); }
});

router.post("/companies/:id/logs", async (req, res, next) => {
  try {
    const companyId = req.params["id"]!;
    const company   = await db(req).crmCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError(404, "Company not found");
    const data = logSchema.parse(req.body);
    const log  = await db(req).crmCompanyLog.create({
      data: {
        companyId,
        type:     data.type,
        subject:  data.subject  || null,
        body:     data.body     || null,
        loggedAt: data.loggedAt ? new Date(data.loggedAt) : new Date(),
      },
    });
    res.status(201).json({ log });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/companies/:id/logs/:logId", async (req, res, next) => {
  try {
    await db(req).crmCompanyLog.delete({ where: { id: req.params["logId"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Company contacts (nested) ────────────────────────────────────────────────

router.post("/companies/:companyId/contacts", async (req, res, next) => {
  try {
    const companyId = req.params["companyId"]!;
    const company   = await db(req).crmCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError(404, "Company not found");

    const data    = contactSchema.parse(req.body);
    const contact = await db(req).crmContact.create({
      data: { ...data, companyId, email: data.email || null },
    });
    res.status(201).json({ contact });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/companies/:companyId/contacts/:contactId", async (req, res, next) => {
  try {
    const data    = contactSchema.partial().parse(req.body);
    const contact = await db(req).crmContact.update({
      where: { id: req.params["contactId"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
    });
    res.json({ contact });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/companies/:companyId/contacts/:contactId", async (req, res, next) => {
  try {
    await db(req).crmContact.delete({ where: { id: req.params["contactId"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── All contacts (flat) ──────────────────────────────────────────────────────

router.get("/contacts", async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit  = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const skip   = (page - 1) * limit;
    const search = String(req.query["search"] ?? "").trim();

    const where = search
      ? { OR: [
          { name:     { contains: search, mode: "insensitive" as const } },
          { position: { contains: search, mode: "insensitive" as const } },
          { email:    { contains: search, mode: "insensitive" as const } },
          { company:  { name: { contains: search, mode: "insensitive" as const } } },
        ] }
      : {};

    const [contacts, total] = await Promise.all([
      db(req).crmContact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { company: { select: { id: true, name: true, industry: true } } },
      }),
      db(req).crmContact.count({ where }),
    ]);
    res.json({ contacts, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/contacts", async (req, res, next) => {
  try {
    const body      = contactSchema.extend({ companyId: z.string().min(1) }).parse(req.body);
    const { companyId, ...data } = body;
    const company   = await db(req).crmCompany.findUnique({ where: { id: companyId } });
    if (!company) throw new AppError(404, "Company not found");
    const contact = await db(req).crmContact.create({
      data: { ...data, companyId, email: data.email || null },
      include: { company: { select: { id: true, name: true, industry: true } } },
    });
    res.status(201).json({ contact });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/contacts/:id", async (req, res, next) => {
  try {
    const data    = contactSchema.partial().parse(req.body);
    const contact = await db(req).crmContact.update({
      where: { id: req.params["id"]! },
      data: { ...data, email: data.email !== undefined ? (data.email || null) : undefined },
      include: { company: { select: { id: true, name: true, industry: true } } },
    });
    res.json({ contact });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/contacts/:id", async (req, res, next) => {
  try {
    await db(req).crmContact.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
