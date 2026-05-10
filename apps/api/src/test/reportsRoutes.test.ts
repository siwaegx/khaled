import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";
import type { MockTenantDb } from "./helpers";
import { router } from "../../../../modules/reports/backend/router";

const ISO = "2026-06-01T00:00:00.000Z";

function makeDb() {
  return {
    lead:         { count: vi.fn(), aggregate: vi.fn() },
    customer:     { count: vi.fn() },
    deal:         { count: vi.fn(), aggregate: vi.fn() },
    product:      { count: vi.fn() },
    warehouse:    { count: vi.fn() },
    purchaseOrder: { count: vi.fn() },
    invoice: {
      count:     vi.fn(),
      aggregate: vi.fn(),
      findMany:  vi.fn(),
    },
    expense: {
      aggregate: vi.fn(),
      findMany:  vi.fn(),
    },
    employee:    { count: vi.fn() },
    leaveRequest: { count: vi.fn() },
    project:     { count: vi.fn() },
    task:        { count: vi.fn() },
    stockLevel:  { findMany: vi.fn() },
  };
}

type Db = ReturnType<typeof makeDb>;

function app(db: Db) {
  return makeApp(router, undefined, db as unknown as MockTenantDb);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /summary
// ═══════════════════════════════════════════════════════════════════════════════

describe("Reports — GET /summary", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns cross-module summary", async () => {
    db.lead.count.mockResolvedValue(10);
    db.customer.count.mockResolvedValue(5);
    db.deal.count.mockResolvedValue(3);
    db.deal.aggregate.mockResolvedValue({ _sum: { value: 15000 } });
    db.product.count.mockResolvedValue(20);
    db.warehouse.count.mockResolvedValue(2);
    db.purchaseOrder.count.mockResolvedValue(4);
    db.invoice.count.mockResolvedValue(12);
    db.invoice.aggregate.mockResolvedValue({ _sum: { total: 8000 } });
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: 3000 } });
    db.employee.count.mockResolvedValue(8);
    db.leaveRequest.count.mockResolvedValue(1);
    db.project.count.mockResolvedValue(3);
    db.task.count.mockResolvedValue(15);

    const res = await request(app(db)).get("/summary");
    expect(res.status).toBe(200);

    expect(res.body.crm.leads).toBe(10);
    expect(res.body.crm.customers).toBe(5);
    expect(res.body.crm.deals).toBe(3);
    expect(res.body.crm.dealValue).toBe(15000);

    expect(res.body.inventory.products).toBe(20);
    expect(res.body.inventory.warehouses).toBe(2);
    expect(res.body.inventory.purchaseOrders).toBe(4);

    expect(res.body.accounting.invoices).toBe(12);
    expect(res.body.accounting.paidRevenue).toBe(8000);
    expect(res.body.accounting.totalExpenses).toBe(3000);

    expect(res.body.hr.activeEmployees).toBe(8);
    expect(res.body.hr.pendingLeave).toBe(1);

    expect(res.body.projects.activeProjects).toBe(3);
    expect(res.body.projects.openTasks).toBe(15);
  });

  it("handles null _sum values (no data) gracefully", async () => {
    db.lead.count.mockResolvedValue(0);
    db.customer.count.mockResolvedValue(0);
    db.deal.count.mockResolvedValue(0);
    db.deal.aggregate.mockResolvedValue({ _sum: { value: null } });
    db.product.count.mockResolvedValue(0);
    db.warehouse.count.mockResolvedValue(0);
    db.purchaseOrder.count.mockResolvedValue(0);
    db.invoice.count.mockResolvedValue(0);
    db.invoice.aggregate.mockResolvedValue({ _sum: { total: null } });
    db.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    db.employee.count.mockResolvedValue(0);
    db.leaveRequest.count.mockResolvedValue(0);
    db.project.count.mockResolvedValue(0);
    db.task.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/summary");
    expect(res.status).toBe(200);
    expect(res.body.crm.dealValue).toBe(0);
    expect(res.body.accounting.paidRevenue).toBe(0);
    expect(res.body.accounting.totalExpenses).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /alerts
// ═══════════════════════════════════════════════════════════════════════════════

describe("Reports — GET /alerts", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns overdue invoices and low stock", async () => {
    db.invoice.findMany.mockResolvedValue([
      { id: "inv1", number: "INV-001", customerName: "Acme", dueDate: new Date("2026-01-01"), total: 500 },
    ]);
    db.stockLevel.findMany.mockResolvedValue([
      {
        id: "sl1", productId: "p1", warehouseId: "wh1",
        quantity: 2, minQuantity: 5,
        product:   { id: "p1",  name: "Widget", sku: "W-001" },
        warehouse: { id: "wh1", name: "Main"                  },
      },
    ]);

    const res = await request(app(db)).get("/alerts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.overdueInvoices)).toBe(true);
    expect(res.body.overdueInvoices).toHaveLength(1);
    expect(res.body.overdueInvoices[0].number).toBe("INV-001");

    // quantity(2) <= minQuantity(5) → low stock
    expect(Array.isArray(res.body.lowStock)).toBe(true);
    expect(res.body.lowStock).toHaveLength(1);
    expect(res.body.lowStock[0].product.name).toBe("Widget");
  });

  it("filters out stock levels not below minimum", async () => {
    db.invoice.findMany.mockResolvedValue([]);
    db.stockLevel.findMany.mockResolvedValue([
      {
        id: "sl1", productId: "p1", warehouseId: "wh1",
        quantity: 10, minQuantity: 5, // 10 > 5 → not low
        product:   { id: "p1",  name: "Widget", sku: "W-001" },
        warehouse: { id: "wh1", name: "Main"                  },
      },
    ]);

    const res = await request(app(db)).get("/alerts");
    expect(res.status).toBe(200);
    expect(res.body.overdueInvoices).toHaveLength(0);
    expect(res.body.lowStock).toHaveLength(0);
  });

  it("returns empty arrays when no alerts", async () => {
    db.invoice.findMany.mockResolvedValue([]);
    db.stockLevel.findMany.mockResolvedValue([]);

    const res = await request(app(db)).get("/alerts");
    expect(res.status).toBe(200);
    expect(res.body.overdueInvoices).toHaveLength(0);
    expect(res.body.lowStock).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /revenue
// ═══════════════════════════════════════════════════════════════════════════════

describe("Reports — GET /revenue", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns monthly revenue vs expenses", async () => {
    db.invoice.findMany.mockResolvedValue([
      { paidDate: new Date("2026-03-15"), total: 1000 },
      { paidDate: new Date("2026-04-20"), total: 2000 },
    ]);
    db.expense.findMany.mockResolvedValue([
      { date: new Date("2026-03-10"), amount: 300 },
      { date: new Date("2026-04-05"), amount: 500 },
    ]);

    const res = await request(app(db)).get("/revenue");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const march = res.body.data.find((d: { month: string }) => d.month === "2026-03");
    const april = res.body.data.find((d: { month: string }) => d.month === "2026-04");

    expect(march).toBeDefined();
    expect(march.revenue).toBe(1000);
    expect(march.expenses).toBe(300);
    expect(march.profit).toBe(700);

    expect(april).toBeDefined();
    expect(april.revenue).toBe(2000);
    expect(april.expenses).toBe(500);
    expect(april.profit).toBe(1500);
  });

  it("returns empty array when no data", async () => {
    db.invoice.findMany.mockResolvedValue([]);
    db.expense.findMany.mockResolvedValue([]);

    const res = await request(app(db)).get("/revenue");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("skips invoices with null paidDate", async () => {
    db.invoice.findMany.mockResolvedValue([
      { paidDate: null, total: 999 },
    ]);
    db.expense.findMany.mockResolvedValue([]);

    const res = await request(app(db)).get("/revenue");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("aggregates multiple records in the same month", async () => {
    db.invoice.findMany.mockResolvedValue([
      { paidDate: new Date("2026-05-01"), total: 500  },
      { paidDate: new Date("2026-05-15"), total: 1500 },
    ]);
    db.expense.findMany.mockResolvedValue([]);

    const res = await request(app(db)).get("/revenue");
    expect(res.status).toBe(200);
    const may = res.body.data.find((d: { month: string }) => d.month === "2026-05");
    expect(may.revenue).toBe(2000);
  });
});
