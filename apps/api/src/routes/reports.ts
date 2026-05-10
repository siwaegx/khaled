import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { resolveTenant } from "../middleware/tenantResolver";
import { AppError } from "../middleware/errorHandler";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, resolveTenant);

type DbModel = {
  count:     (a?: unknown) => Promise<number>;
  aggregate: (a: unknown) => Promise<{ _sum: Record<string, number | null> }>;
  findMany:  (a?: unknown) => Promise<unknown[]>;
};

type ReportsDb = Record<string, DbModel | undefined>;

function db(req: Request): ReportsDb {
  if (!req.tenantDb) throw new AppError(503, "Tenant database not available");
  return req.tenantDb as unknown as ReportsDb;
}

// GET /api/reports/summary — cross-module KPI cards
reportsRouter.get("/summary", async (req, res, next) => {
  try {
    const d = db(req);

    const [
      leads, customers, deals, dealAgg,
      products, warehouses, purchaseOrders,
      invoices, invoiceAgg, expenseAgg,
      employees, pendingLeave,
      projects, tasks,
    ] = await Promise.allSettled([
      d.lead?.count()            ?? Promise.resolve(0),
      d.customer?.count()        ?? Promise.resolve(0),
      d.deal?.count()            ?? Promise.resolve(0),
      d.deal?.aggregate({ _sum: { value: true } }) ?? Promise.resolve({ _sum: { value: 0 } }),
      d.product?.count()         ?? Promise.resolve(0),
      d.warehouse?.count()       ?? Promise.resolve(0),
      d.purchaseOrder?.count()   ?? Promise.resolve(0),
      d.invoice?.count()         ?? Promise.resolve(0),
      d.invoice?.aggregate({ _sum: { total: true } }) ?? Promise.resolve({ _sum: { total: 0 } }),
      d.expense?.aggregate({ _sum: { amount: true } }) ?? Promise.resolve({ _sum: { amount: 0 } }),
      d.employee?.count()        ?? Promise.resolve(0),
      d.leaveRequest?.count({ where: { status: "pending" } }) ?? Promise.resolve(0),
      d.project?.count()         ?? Promise.resolve(0),
      d.task?.count({ where: { status: { not: "done" } } }) ?? Promise.resolve(0),
    ]);

    function val<T>(r: PromiseSettledResult<T>, fallback: T): T {
      return r.status === "fulfilled" ? r.value : fallback;
    }
    function sumVal(r: PromiseSettledResult<{ _sum: Record<string, number | null> }>, key: string): number {
      return r.status === "fulfilled" ? (r.value._sum[key] ?? 0) : 0;
    }

    res.json({
      crm: {
        leads:     val(leads, 0),
        customers: val(customers, 0),
        deals:     val(deals, 0),
        dealValue: sumVal(dealAgg, "value"),
      },
      inventory: {
        products:       val(products, 0),
        warehouses:     val(warehouses, 0),
        purchaseOrders: val(purchaseOrders, 0),
      },
      accounting: {
        invoices:      val(invoices, 0),
        paidRevenue:   sumVal(invoiceAgg, "total"),
        totalExpenses: sumVal(expenseAgg, "amount"),
      },
      hr: {
        activeEmployees: val(employees, 0),
        pendingLeave:    val(pendingLeave, 0),
      },
      projects: {
        activeProjects: val(projects, 0),
        openTasks:      val(tasks, 0),
      },
    });
  } catch (err) { next(err); }
});

// GET /api/reports/revenue — monthly revenue vs expenses (last 12 months)
reportsRouter.get("/revenue", async (req, res, next) => {
  try {
    const d = db(req);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 11);
    cutoff.setDate(1);
    cutoff.setHours(0, 0, 0, 0);

    const [invoicesRaw, expensesRaw] = await Promise.all([
      d.invoice?.findMany({
        where:  { paidDate: { gte: cutoff } },
        select: { paidDate: true, total: true },
      }) ?? Promise.resolve([]),
      d.expense?.findMany({
        where:  { date: { gte: cutoff } },
        select: { date: true, amount: true },
      }) ?? Promise.resolve([]),
    ]);

    const map = new Map<string, { revenue: number; expenses: number }>();

    for (const inv of invoicesRaw as { paidDate: Date | null; total: number }[]) {
      if (!inv.paidDate) continue;
      const m = `${inv.paidDate.getFullYear()}-${String(inv.paidDate.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(m)) map.set(m, { revenue: 0, expenses: 0 });
      map.get(m)!.revenue += inv.total ?? 0;
    }

    for (const exp of expensesRaw as { date: Date; amount: number }[]) {
      const m = `${exp.date.getFullYear()}-${String(exp.date.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(m)) map.set(m, { revenue: 0, expenses: 0 });
      map.get(m)!.expenses += exp.amount ?? 0;
    }

    const data = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { revenue, expenses }]) => ({
        month,
        revenue,
        expenses,
        profit: revenue - expenses,
      }));

    res.json({ data });
  } catch (err) { next(err); }
});

// GET /api/reports/alerts — overdue invoices + low stock items
reportsRouter.get("/alerts", async (req, res, next) => {
  try {
    const d = db(req);
    const now = new Date();

    const [invoicesRaw, stockRaw] = await Promise.all([
      d.invoice?.findMany({
        where:  { dueDate: { lt: now }, status: { not: "paid" } },
        select: { id: true, number: true, customerName: true, dueDate: true, total: true },
      }) ?? Promise.resolve([]),
      d.stockLevel?.findMany({
        include: { product: true, warehouse: true },
      }) ?? Promise.resolve([]),
    ]);

    // Filter: quantity <= minQuantity (Prisma can't compare two columns in WHERE)
    const lowStock = (stockRaw as {
      id: string; quantity: number; minQuantity: number;
      product: { id: string; name: string; sku: string };
      warehouse: { id: string; name: string };
    }[]).filter((s) => s.quantity <= s.minQuantity);

    res.json({
      overdueInvoices: invoicesRaw,
      lowStock,
    });
  } catch (err) { next(err); }
});
