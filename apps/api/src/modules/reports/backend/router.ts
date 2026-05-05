import { Router } from "express";

export const router = Router();

// ─── Cross-module summary report ──────────────────────────────────────────────

router.get("/summary", async (req, res, next) => {
  try {
    const db = req.tenantDb!;
    const [
      crmStats,
      inventoryStats,
      accountingStats,
      hrStats,
      projectStats,
    ] = await Promise.all([
      Promise.all([
        db.lead.count(),
        db.customer.count(),
        db.deal.count(),
        db.deal.aggregate({ _sum: { value: true } }),
      ]),
      Promise.all([
        db.product.count(),
        db.warehouse.count(),
        db.purchaseOrder.count(),
      ]),
      Promise.all([
        db.invoice.count(),
        db.invoice.aggregate({ _sum: { total: true }, where: { status: "paid" } }),
        db.expense.aggregate({ _sum: { amount: true } }),
      ]),
      Promise.all([
        db.employee.count({ where: { status: "active" } }),
        db.leaveRequest.count({ where: { status: "pending" } }),
      ]),
      Promise.all([
        db.project.count({ where: { status: "active" } }),
        db.task.count({ where: { status: { in: ["todo", "in_progress"] } } }),
      ]),
    ]);

    res.json({
      crm: {
        leads:    crmStats[0],
        customers: crmStats[1],
        deals:    crmStats[2],
        dealValue: crmStats[3]._sum.value ?? 0,
      },
      inventory: {
        products:       inventoryStats[0],
        warehouses:     inventoryStats[1],
        purchaseOrders: inventoryStats[2],
      },
      accounting: {
        invoices:    accountingStats[0],
        paidRevenue: accountingStats[1]._sum.total ?? 0,
        totalExpenses: accountingStats[2]._sum.amount ?? 0,
      },
      hr: {
        activeEmployees: hrStats[0],
        pendingLeave:    hrStats[1],
      },
      projects: {
        activeProjects: projectStats[0],
        openTasks:      projectStats[1],
      },
    });
  } catch (err) { next(err); }
});

// ─── Alerts ───────────────────────────────────────────────────────────────────

router.get("/alerts", async (req, res, next) => {
  try {
    const db  = req.tenantDb!;
    const now = new Date();

    const [overdueInvoices, lowStockLevels] = await Promise.all([
      db.invoice.findMany({
        where: {
          status:  { notIn: ["paid", "cancelled"] },
          dueDate: { lt: now },
        },
        select: { id: true, number: true, customerName: true, dueDate: true, total: true },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),
      db.stockLevel.findMany({
        where: { minQuantity: { gt: 0 } },
        include: {
          product:   { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        take: 50,
      }),
    ]);

    const lowStock = lowStockLevels.filter((sl) => sl.quantity <= sl.minQuantity);

    res.json({ overdueInvoices, lowStock });
  } catch (err) { next(err); }
});

// ─── Revenue vs Expenses (monthly) ───────────────────────────────────────────

router.get("/revenue", async (req, res, next) => {
  try {
    const db = req.tenantDb!;
    const [paidInvoices, expenses] = await Promise.all([
      db.invoice.findMany({
        where: { status: "paid" },
        select: { paidDate: true, total: true },
        orderBy: { paidDate: "asc" },
      }),
      db.expense.findMany({
        select: { date: true, amount: true },
        orderBy: { date: "asc" },
      }),
    ]);

    const monthKey = (d: Date | null) =>
      d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : null;

    const revenueMap: Record<string, number> = {};
    for (const inv of paidInvoices) {
      const k = monthKey(inv.paidDate);
      if (k) revenueMap[k] = (revenueMap[k] ?? 0) + inv.total;
    }

    const expenseMap: Record<string, number> = {};
    for (const exp of expenses) {
      const k = monthKey(exp.date);
      if (k) expenseMap[k] = (expenseMap[k] ?? 0) + exp.amount;
    }

    const allMonths = Array.from(new Set([...Object.keys(revenueMap), ...Object.keys(expenseMap)])).sort();
    const data = allMonths.map(month => ({
      month,
      revenue:  revenueMap[month] ?? 0,
      expenses: expenseMap[month] ?? 0,
      profit:   (revenueMap[month] ?? 0) - (expenseMap[month] ?? 0),
    }));

    res.json({ data });
  } catch (err) { next(err); }
});
