import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { resolveTenant } from "../middleware/tenantResolver";
import { AppError } from "../middleware/errorHandler";

export const searchRouter = Router();
searchRouter.use(requireAuth, resolveTenant);

type SearchResult = { id: string; label: string; sublabel?: string; entity: string; href: string };
type DbTable = { findMany: (args: unknown) => Promise<unknown[]> };
type SearchDb = Record<string, DbTable>;

// GET /api/search?q=<query> — cross-module full-text search across tenant data
searchRouter.get("/", async (req, res, next) => {
  try {
    const q = ((req.query["q"] as string) ?? "").trim();
    if (!q || q.length < 2) return res.json({ results: [], total: 0 });

    const db = req.tenantDb;
    if (!db) throw new AppError(503, "No tenant database for this organization");

    const sdb = db as unknown as SearchDb;
    const contains = { contains: q, mode: "insensitive" };
    const LIMIT = 5;

    const settled = await Promise.allSettled([
      sdb["lead"]?.findMany({ where: { OR: [{ name: contains }, { email: contains }, { company: contains }] }, select: { id: true, name: true, company: true }, take: LIMIT }),
      sdb["customer"]?.findMany({ where: { OR: [{ name: contains }, { email: contains }, { company: contains }] }, select: { id: true, name: true, company: true }, take: LIMIT }),
      sdb["deal"]?.findMany({ where: { OR: [{ title: contains }, { notes: contains }] }, select: { id: true, title: true, status: true }, take: LIMIT }),
      sdb["product"]?.findMany({ where: { OR: [{ name: contains }, { sku: contains }] }, select: { id: true, name: true, sku: true }, take: LIMIT }),
      sdb["employee"]?.findMany({ where: { OR: [{ name: contains }, { email: contains }, { position: contains }] }, select: { id: true, name: true, position: true, department: true }, take: LIMIT }),
      sdb["invoice"]?.findMany({ where: { OR: [{ number: contains }, { customerName: contains }] }, select: { id: true, number: true, customerName: true, status: true }, take: LIMIT }),
      sdb["project"]?.findMany({ where: { OR: [{ name: contains }, { description: contains }] }, select: { id: true, name: true, status: true }, take: LIMIT }),
      sdb["task"]?.findMany({ where: { OR: [{ title: contains }, { description: contains }] }, select: { id: true, title: true, status: true }, take: LIMIT }),
    ]);

    function rows(r: PromiseSettledResult<unknown[] | undefined>): Record<string, unknown>[] {
      return r.status === "fulfilled" && Array.isArray(r.value) ? (r.value as Record<string, unknown>[]) : [];
    }

    const [leads, customers, deals, products, employees, invoices, projects, tasks] = settled;

    const results: SearchResult[] = [
      ...rows(leads).map((x)     => ({ id: String(x["id"]), label: String(x["name"]), sublabel: x["company"] as string | undefined, entity: "lead",     href: "/dashboard/crm/leads"             })),
      ...rows(customers).map((x) => ({ id: String(x["id"]), label: String(x["name"]), sublabel: x["company"] as string | undefined, entity: "customer",  href: "/dashboard/crm/customers"         })),
      ...rows(deals).map((x)     => ({ id: String(x["id"]), label: String(x["title"]), sublabel: x["status"] as string | undefined, entity: "deal",      href: "/dashboard/crm/deals"             })),
      ...rows(products).map((x)  => ({ id: String(x["id"]), label: String(x["name"]), sublabel: x["sku"] as string | undefined,     entity: "product",   href: "/dashboard/inventory/products"    })),
      ...rows(employees).map((x) => ({ id: String(x["id"]), label: String(x["name"]), sublabel: [x["position"], x["department"]].filter(Boolean).join(" · ") || undefined, entity: "employee", href: "/dashboard/hr/employees" })),
      ...rows(invoices).map((x)  => ({ id: String(x["id"]), label: String(x["number"]), sublabel: x["customerName"] as string | undefined, entity: "invoice",  href: "/dashboard/accounting/invoices"   })),
      ...rows(projects).map((x)  => ({ id: String(x["id"]), label: String(x["name"]), sublabel: x["status"] as string | undefined,  entity: "project",   href: "/dashboard/projects"              })),
      ...rows(tasks).map((x)     => ({ id: String(x["id"]), label: String(x["title"]), sublabel: x["status"] as string | undefined, entity: "task",      href: "/dashboard/projects/tasks"        })),
    ];

    res.json({ results, total: results.length });
  } catch (err) { next(err); }
});
