import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";
import type { MockTenantDb } from "./helpers";
import { router } from "../../../../modules/accounting/backend/router";

const ISO = "2026-06-01T00:00:00.000Z";

function makeDb() {
  return {
    invoice: {
      count:      vi.fn(),
      groupBy:    vi.fn(),
      aggregate:  vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
    invoiceItem: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    expense: {
      count:     vi.fn(),
      groupBy:   vi.fn(),
      aggregate: vi.fn(),
      findMany:  vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

function app(db: Db) {
  return makeApp(router, undefined, db as unknown as MockTenantDb);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const INVOICE = {
  id: "inv1", number: "INV-001", customerName: "Acme Corp", customerId: null,
  status: "draft", subtotal: 100, tax: 10, total: 110,
  notes: null, issueDate: ISO, dueDate: ISO, paidDate: null,
  createdAt: ISO, updatedAt: ISO, _count: { items: 2 },
};

const EXPENSE = {
  id: "exp1", category: "Travel", description: "Client visit", amount: 250,
  currency: "USD", date: ISO, reference: null, notes: null,
  createdAt: ISO, updatedAt: ISO,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /stats
// ═══════════════════════════════════════════════════════════════════════════════

describe("Accounting — GET /stats", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns all KPIs", async () => {
    db.invoice.count.mockResolvedValue(20);
    db.expense.count.mockResolvedValue(8);
    db.invoice.groupBy.mockResolvedValue([
      { status: "paid",     _count: { id: 5 }, _sum: { total: 5000 } },
      { status: "sent",     _count: { id: 3 }, _sum: { total: 1500 } },
      { status: "overdue",  _count: { id: 2 }, _sum: { total: 800  } },
    ]);
    db.expense.groupBy.mockResolvedValue([
      { category: "Travel", _count: { id: 4 }, _sum: { amount: 1200 } },
    ]);

    const res = await request(app(db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalInvoices).toBe(20);
    expect(res.body.totalExpenses).toBe(8);
    expect(res.body.paidTotal).toBe(5000);
    expect(res.body.outstandingTotal).toBe(2300); // 1500 + 800
    expect(Array.isArray(res.body.invoicesByStatus)).toBe(true);
  });

  it("handles zero revenue gracefully", async () => {
    db.invoice.count.mockResolvedValue(0);
    db.expense.count.mockResolvedValue(0);
    db.invoice.groupBy.mockResolvedValue([]);
    db.expense.groupBy.mockResolvedValue([]);

    const res = await request(app(db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.paidTotal).toBe(0);
    expect(res.body.outstandingTotal).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Invoices
// ═══════════════════════════════════════════════════════════════════════════════

describe("Accounting Invoices", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /invoices returns paginated list", async () => {
    db.invoice.findMany.mockResolvedValue([INVOICE]);
    db.invoice.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/invoices");
    expect(res.status).toBe(200);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0].number).toBe("INV-001");
  });

  it("GET /invoices filters by status", async () => {
    db.invoice.findMany.mockResolvedValue([]);
    db.invoice.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/invoices?status=paid");
    expect(res.status).toBe(200);
    expect(db.invoice.findMany).toHaveBeenCalledOnce();
  });

  it("GET /invoices/:id returns invoice with items", async () => {
    db.invoice.findUnique.mockResolvedValue({ ...INVOICE, items: [] });

    const res = await request(app(db)).get("/invoices/inv1");
    expect(res.status).toBe(200);
    expect(res.body.invoice.id).toBe("inv1");
    expect(Array.isArray(res.body.invoice.items)).toBe(true);
  });

  it("GET /invoices/:id returns 404 when not found", async () => {
    db.invoice.findUnique.mockResolvedValue(null);

    const res = await request(app(db)).get("/invoices/nope");
    expect(res.status).toBe(404);
  });

  it("POST /invoices creates an invoice", async () => {
    db.invoice.create.mockResolvedValue(INVOICE);

    const res = await request(app(db)).post("/invoices")
      .send({ number: "INV-001", customerName: "Acme Corp" });
    expect(res.status).toBe(201);
    expect(res.body.invoice.number).toBe("INV-001");
  });

  it("POST /invoices rejects missing number", async () => {
    const res = await request(app(db)).post("/invoices").send({ customerName: "Acme" });
    expect(res.status).toBe(400);
  });

  it("POST /invoices rejects missing customerName", async () => {
    const res = await request(app(db)).post("/invoices").send({ number: "INV-001" });
    expect(res.status).toBe(400);
  });

  it("POST /invoices rejects invalid status", async () => {
    const res = await request(app(db)).post("/invoices")
      .send({ number: "INV-001", customerName: "Acme", status: "bounced" });
    expect(res.status).toBe(400);
  });

  it("POST /invoices rejects negative subtotal", async () => {
    const res = await request(app(db)).post("/invoices")
      .send({ number: "INV-001", customerName: "Acme", subtotal: -10 });
    expect(res.status).toBe(400);
  });

  it("PATCH /invoices/:id updates status", async () => {
    db.invoice.update.mockResolvedValue({ ...INVOICE, status: "paid" });

    const res = await request(app(db)).patch("/invoices/inv1").send({ status: "paid" });
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe("paid");
  });

  it("DELETE /invoices/:id deletes invoice", async () => {
    db.invoice.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/invoices/inv1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /invoices/:id/items adds a line item", async () => {
    db.invoiceItem.create.mockResolvedValue({
      id: "item1", invoiceId: "inv1", description: "Consulting",
      quantity: 2, unitPrice: 100, amount: 200,
    });

    const res = await request(app(db)).post("/invoices/inv1/items")
      .send({ description: "Consulting", quantity: 2, unitPrice: 100, amount: 200 });
    expect(res.status).toBe(201);
    expect(res.body.item.description).toBe("Consulting");
  });

  it("POST /invoices/:id/items rejects zero quantity", async () => {
    const res = await request(app(db)).post("/invoices/inv1/items")
      .send({ description: "Consulting", quantity: 0, unitPrice: 100, amount: 0 });
    expect(res.status).toBe(400);
  });

  it("POST /invoices/:id/items rejects missing description", async () => {
    const res = await request(app(db)).post("/invoices/inv1/items")
      .send({ quantity: 1, unitPrice: 100, amount: 100 });
    expect(res.status).toBe(400);
  });

  it("DELETE /invoices/:id/items/:itemId removes line item", async () => {
    db.invoiceItem.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/invoices/inv1/items/item1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Expenses
// ═══════════════════════════════════════════════════════════════════════════════

describe("Accounting Expenses", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /expenses returns paginated list", async () => {
    db.expense.findMany.mockResolvedValue([EXPENSE]);
    db.expense.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/expenses");
    expect(res.status).toBe(200);
    expect(res.body.expenses).toHaveLength(1);
    expect(res.body.expenses[0].category).toBe("Travel");
  });

  it("GET /expenses filters by category", async () => {
    db.expense.findMany.mockResolvedValue([]);
    db.expense.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/expenses?category=Travel");
    expect(res.status).toBe(200);
    expect(db.expense.findMany).toHaveBeenCalledOnce();
  });

  it("POST /expenses creates an expense", async () => {
    db.expense.create.mockResolvedValue(EXPENSE);

    const res = await request(app(db)).post("/expenses")
      .send({ category: "Travel", description: "Client visit", amount: 250 });
    expect(res.status).toBe(201);
    expect(res.body.expense.category).toBe("Travel");
  });

  it("POST /expenses rejects missing category", async () => {
    const res = await request(app(db)).post("/expenses")
      .send({ description: "Trip", amount: 100 });
    expect(res.status).toBe(400);
  });

  it("POST /expenses rejects missing description", async () => {
    const res = await request(app(db)).post("/expenses")
      .send({ category: "Travel", amount: 100 });
    expect(res.status).toBe(400);
  });

  it("POST /expenses rejects zero amount", async () => {
    const res = await request(app(db)).post("/expenses")
      .send({ category: "Travel", description: "Free coffee", amount: 0 });
    expect(res.status).toBe(400);
  });

  it("POST /expenses rejects negative amount", async () => {
    const res = await request(app(db)).post("/expenses")
      .send({ category: "Travel", description: "Refund", amount: -50 });
    expect(res.status).toBe(400);
  });

  it("PATCH /expenses/:id updates expense", async () => {
    db.expense.update.mockResolvedValue({ ...EXPENSE, amount: 300 });

    const res = await request(app(db)).patch("/expenses/exp1").send({ amount: 300 });
    expect(res.status).toBe(200);
    expect(res.body.expense.amount).toBe(300);
  });

  it("DELETE /expenses/:id deletes expense", async () => {
    db.expense.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/expenses/exp1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
