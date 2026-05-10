import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const configListsRouter = Router();
configListsRouter.use(requireAuth);

// ─── Default system lists seeded on first access ──────────────────────────────

const DEFAULT_LISTS: { key: string; label: string; description: string; items: string[] }[] = [
  {
    key: "job_titles",
    label: "Job Titles",
    description: "Employee and contact job titles across the organization.",
    items: [
      "CEO", "COO", "CTO", "CFO", "CMO", "VP Sales", "VP Marketing", "VP Engineering",
      "Sales Manager", "Account Manager", "Business Developer", "Sales Representative",
      "Software Engineer", "Senior Engineer", "Engineering Manager", "DevOps Engineer",
      "Designer", "Product Manager", "HR Manager", "Recruiter",
      "Accountant", "Financial Analyst", "Office Manager", "Executive Assistant",
    ],
  },
  {
    key: "industries",
    label: "Industries",
    description: "Industry sectors for companies and leads.",
    items: [
      "Technology", "Software & SaaS", "Healthcare", "Finance & Banking",
      "Insurance", "Real Estate", "Construction", "Manufacturing",
      "Retail & E-commerce", "Wholesale & Distribution", "Education",
      "Legal", "Consulting", "Media & Entertainment", "Advertising & Marketing",
      "Logistics & Transport", "Energy & Utilities", "Agriculture", "Non-Profit",
      "Government", "Hospitality & Tourism", "Food & Beverage",
    ],
  },
  {
    key: "contact_positions",
    label: "Contact Positions",
    description: "The role a contact plays in the sales or business relationship.",
    items: [
      "Decision Maker", "Influencer", "Champion", "Stakeholder",
      "Technical Contact", "Financial Contact", "End User",
      "Gatekeeper", "Executive Sponsor", "Legal Contact",
    ],
  },
  {
    key: "lead_sources",
    label: "Lead Sources",
    description: "How a lead or opportunity was originally acquired.",
    items: [
      "Website", "Referral", "Cold Call", "Email Campaign",
      "Social Media", "LinkedIn", "Trade Show / Event",
      "Partner / Reseller", "Advertisement", "Organic Search",
      "Direct / Walk-in", "Other",
    ],
  },
  {
    key: "areas",
    label: "Areas / Regions",
    description: "Geographic areas or regions used in contacts and leads.",
    items: [],
  },
  {
    key: "cities",
    label: "Cities",
    description: "Cities used in contacts, leads, and addresses.",
    items: [],
  },
  {
    key: "currencies",
    label: "Currencies",
    description: "Accepted currencies for invoices, deals, and expenses.",
    items: [
      "USD", "EUR", "GBP", "AED", "SAR", "KWD", "BHD", "QAR",
      "EGP", "JPY", "CNY", "INR", "CAD", "AUD", "CHF", "SGD",
    ],
  },
  {
    key: "expense_categories",
    label: "Expense Categories",
    description: "Categories for classifying accounting expenses.",
    items: [
      "Travel & Transport", "Accommodation", "Office Supplies", "Software & Subscriptions",
      "Hardware & Equipment", "Marketing & Advertising", "Meals & Entertainment",
      "Professional Services", "Utilities", "Training & Education",
      "Salaries & Payroll", "Rent & Facilities", "Insurance", "Other",
    ],
  },
  {
    key: "product_categories",
    label: "Product Categories",
    description: "Categories for organizing inventory products.",
    items: [
      "Electronics", "Software", "Physical Goods", "Digital Goods",
      "Subscriptions", "Services", "Consulting", "Spare Parts",
      "Raw Materials", "Finished Goods", "Other",
    ],
  },
  {
    key: "tags",
    label: "Tags",
    description: "General-purpose tags for labeling records across modules.",
    items: ["VIP", "Hot", "Cold", "Priority", "Follow-up", "Archived"],
  },
  {
    key: "member_roles",
    label: "Member Roles",
    description: "Organization roles that control module access. Used in the Module Access matrix.",
    items: ["manager", "sales_leader", "inventory_manager", "accountant", "engineer", "service_agent", "member"],
  },
];

async function ensureDefaultLists(orgId: string) {
  const existing = await prisma.configList.findMany({ where: { organizationId: orgId }, select: { key: true } });
  const existingKeys = new Set(existing.map((l) => l.key));

  for (const def of DEFAULT_LISTS) {
    if (existingKeys.has(def.key)) continue;
    const list = await prisma.configList.create({
      data: {
        organizationId: orgId,
        key:            def.key,
        label:          def.label,
        description:    def.description,
        isSystem:       true,
      },
    });
    if (def.items.length > 0) {
      await prisma.configListItem.createMany({
        data: def.items.map((value, i) => ({ listId: list.id, value, order: i })),
      });
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/org/config — all lists with items (auto-seeds defaults on first call)
configListsRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    await ensureDefaultLists(orgId);
    const lists = await prisma.configList.findMany({
      where:   { organizationId: orgId },
      include: { items: { where: { isActive: true }, orderBy: { order: "asc" } } },
      orderBy: [{ isSystem: "desc" }, { label: "asc" }],
    });
    res.json({ lists });
  } catch (err) { next(err); }
});

// GET /api/org/config/:key — single list
configListsRouter.get("/:key", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const list = await prisma.configList.findUnique({
      where:   { organizationId_key: { organizationId: orgId, key: req.params.key } },
      include: { items: { where: { isActive: true }, orderBy: { order: "asc" } } },
    });
    if (!list) throw new AppError(404, "List not found");
    res.json({ list });
  } catch (err) { next(err); }
});

// POST /api/org/config — create custom list (manager+)
const createListSchema = z.object({
  key:         z.string().min(2).regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers, and underscores only"),
  label:       z.string().min(1),
  description: z.string().optional(),
});

configListsRouter.post("/", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const data  = createListSchema.parse(req.body);
    const existing = await prisma.configList.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: data.key } },
    });
    if (existing) throw new AppError(409, `A list with key "${data.key}" already exists`);
    const list = await prisma.configList.create({
      data: { organizationId: orgId, ...data, isSystem: false },
      include: { items: true },
    });
    res.status(201).json({ list });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /api/org/config/:key — delete custom list only (manager+)
configListsRouter.delete("/:key", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const list  = await prisma.configList.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: req.params.key } },
    });
    if (!list)          throw new AppError(404, "List not found");
    if (list.isSystem)  throw new AppError(400, "System lists cannot be deleted");
    await prisma.configList.delete({ where: { id: list.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/org/config/:key/items — add item (manager+)
const itemSchema = z.object({
  value: z.string().min(1),
  color: z.string().optional(),
});

configListsRouter.post("/:key/items", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const list  = await prisma.configList.findUnique({
      where:   { organizationId_key: { organizationId: orgId, key: req.params.key } },
      include: { items: { orderBy: { order: "desc" }, take: 1 } },
    });
    if (!list) throw new AppError(404, "List not found");
    const { value, color } = itemSchema.parse(req.body);
    const nextOrder = (list.items[0]?.order ?? -1) + 1;
    const item = await prisma.configListItem.create({
      data: { listId: list.id, value, color, order: nextOrder },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// PATCH /api/org/config/:key/items/:itemId — update item (manager+)
const patchItemSchema = z.object({
  value:    z.string().min(1).optional(),
  color:    z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

configListsRouter.patch("/:key/items/:itemId", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const list  = await prisma.configList.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: req.params.key } },
    });
    if (!list) throw new AppError(404, "List not found");
    const data = patchItemSchema.parse(req.body);
    const item = await prisma.configListItem.update({
      where: { id: req.params.itemId },
      data,
    });
    res.json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /api/org/config/:key/items/:itemId — remove item (manager+)
configListsRouter.delete("/:key/items/:itemId", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const list  = await prisma.configList.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: req.params.key } },
    });
    if (!list) throw new AppError(404, "List not found");
    await prisma.configListItem.delete({ where: { id: req.params.itemId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /api/org/config/:key/items/reorder — reorder items (manager+)
configListsRouter.put("/:key/items/reorder", requireRole("manager"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    const list  = await prisma.configList.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: req.params.key } },
    });
    if (!list) throw new AppError(404, "List not found");
    const { order } = z.object({ order: z.array(z.string()) }).parse(req.body);
    await Promise.all(
      order.map((id, i) => prisma.configListItem.update({ where: { id }, data: { order: i } }))
    );
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});
