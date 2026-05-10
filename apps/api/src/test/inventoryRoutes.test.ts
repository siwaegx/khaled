import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";
import type { MockTenantDb } from "./helpers";
import { router } from "../../../../modules/inventory/backend/router";

const ISO = "2026-06-01T00:00:00.000Z";

function makeDb() {
  return {
    product: {
      count:   vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      create:  vi.fn(),
      update:  vi.fn(),
      delete:  vi.fn(),
    },
    warehouse: {
      count:   vi.fn(),
      findMany: vi.fn(),
      create:  vi.fn(),
      update:  vi.fn(),
      delete:  vi.fn(),
    },
    purchaseOrder: {
      count:      vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
    purchaseOrderItem: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    stockLevel: {
      upsert: vi.fn(),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

function app(db: Db) {
  return makeApp(router, undefined, db as unknown as MockTenantDb);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PRODUCT = {
  id: "p1", name: "Widget", sku: "W-001", description: null, category: "Electronics",
  unitPrice: 9.99, costPrice: 5.00, unit: "ea", status: "active",
  createdAt: ISO, updatedAt: ISO, stockLevels: [],
};

const WAREHOUSE = {
  id: "wh1", name: "Main Warehouse", location: "Building A", description: null,
  createdAt: ISO, updatedAt: ISO, _count: { stockLevels: 3 },
};

const ORDER = {
  id: "o1", supplierName: "Acme Supplies", status: "draft", totalAmount: 500,
  notes: null, orderDate: null, expectedDate: null,
  createdAt: ISO, updatedAt: ISO, _count: { items: 2 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /stats
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory — GET /stats", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("returns all KPIs", async () => {
    db.product.count.mockResolvedValue(10);
    db.warehouse.count.mockResolvedValue(3);
    db.purchaseOrder.count.mockResolvedValue(5);
    db.product.groupBy.mockResolvedValue([{ status: "active", _count: { id: 8 } }]);

    const res = await request(app(db)).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalProducts).toBe(10);
    expect(res.body.totalWarehouses).toBe(3);
    expect(res.body.totalOrders).toBe(5);
    expect(Array.isArray(res.body.productsByStatus)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Products
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory Products", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /products returns list with pagination", async () => {
    db.product.findMany.mockResolvedValue([PRODUCT]);
    db.product.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].name).toBe("Widget");
  });

  it("GET /products respects page and limit", async () => {
    db.product.findMany.mockResolvedValue([]);
    db.product.count.mockResolvedValue(0);

    const res = await request(app(db)).get("/products?page=2&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
  });

  it("POST /products creates a product", async () => {
    db.product.create.mockResolvedValue(PRODUCT);

    const res = await request(app(db)).post("/products").send({ name: "Widget", sku: "W-001" });
    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe("Widget");
  });

  it("POST /products rejects missing name", async () => {
    const res = await request(app(db)).post("/products").send({ sku: "W-001" });
    expect(res.status).toBe(400);
  });

  it("POST /products rejects missing sku", async () => {
    const res = await request(app(db)).post("/products").send({ name: "Widget" });
    expect(res.status).toBe(400);
  });

  it("POST /products rejects invalid status", async () => {
    const res = await request(app(db)).post("/products")
      .send({ name: "Widget", sku: "W-001", status: "selling" });
    expect(res.status).toBe(400);
  });

  it("POST /products rejects negative unitPrice", async () => {
    const res = await request(app(db)).post("/products")
      .send({ name: "Widget", sku: "W-001", unitPrice: -1 });
    expect(res.status).toBe(400);
  });

  it("PATCH /products/:id updates product", async () => {
    db.product.update.mockResolvedValue({ ...PRODUCT, status: "inactive" });

    const res = await request(app(db)).patch("/products/p1").send({ status: "inactive" });
    expect(res.status).toBe(200);
    expect(res.body.product.status).toBe("inactive");
  });

  it("DELETE /products/:id deletes product", async () => {
    db.product.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/products/p1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Warehouses
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory Warehouses", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /warehouses returns list", async () => {
    db.warehouse.findMany.mockResolvedValue([WAREHOUSE]);

    const res = await request(app(db)).get("/warehouses");
    expect(res.status).toBe(200);
    expect(res.body.warehouses).toHaveLength(1);
    expect(res.body.warehouses[0].name).toBe("Main Warehouse");
  });

  it("POST /warehouses creates warehouse", async () => {
    db.warehouse.create.mockResolvedValue(WAREHOUSE);

    const res = await request(app(db)).post("/warehouses").send({ name: "Main Warehouse" });
    expect(res.status).toBe(201);
    expect(res.body.warehouse.name).toBe("Main Warehouse");
  });

  it("POST /warehouses rejects missing name", async () => {
    const res = await request(app(db)).post("/warehouses").send({ location: "Building A" });
    expect(res.status).toBe(400);
  });

  it("PATCH /warehouses/:id updates warehouse", async () => {
    db.warehouse.update.mockResolvedValue({ ...WAREHOUSE, location: "Building B" });

    const res = await request(app(db)).patch("/warehouses/wh1").send({ location: "Building B" });
    expect(res.status).toBe(200);
    expect(res.body.warehouse.location).toBe("Building B");
  });

  it("DELETE /warehouses/:id deletes warehouse", async () => {
    db.warehouse.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/warehouses/wh1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Stock Adjustment
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory — POST /stock/adjust", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("upserts stock level", async () => {
    db.stockLevel.upsert.mockResolvedValue({ id: "sl1", productId: "p1", warehouseId: "wh1", quantity: 50, minQuantity: 5 });

    const res = await request(app(db)).post("/stock/adjust")
      .send({ productId: "p1", warehouseId: "wh1", quantity: 50, minQuantity: 5 });
    expect(res.status).toBe(200);
    expect(res.body.stock.quantity).toBe(50);
  });

  it("rejects missing productId", async () => {
    const res = await request(app(db)).post("/stock/adjust")
      .send({ warehouseId: "wh1", quantity: 10 });
    expect(res.status).toBe(400);
  });

  it("rejects negative minQuantity", async () => {
    const res = await request(app(db)).post("/stock/adjust")
      .send({ productId: "p1", warehouseId: "wh1", quantity: 10, minQuantity: -1 });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Purchase Orders
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inventory Purchase Orders", () => {
  let db: Db;
  beforeEach(() => { db = makeDb(); });

  it("GET /orders returns paginated list", async () => {
    db.purchaseOrder.findMany.mockResolvedValue([ORDER]);
    db.purchaseOrder.count.mockResolvedValue(1);

    const res = await request(app(db)).get("/orders");
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it("POST /orders creates an order", async () => {
    db.purchaseOrder.create.mockResolvedValue(ORDER);

    const res = await request(app(db)).post("/orders").send({ supplierName: "Acme" });
    expect(res.status).toBe(201);
    expect(res.body.order.supplierName).toBe("Acme Supplies");
  });

  it("POST /orders rejects missing supplierName", async () => {
    const res = await request(app(db)).post("/orders").send({ totalAmount: 100 });
    expect(res.status).toBe(400);
  });

  it("POST /orders rejects invalid status", async () => {
    const res = await request(app(db)).post("/orders").send({ supplierName: "Acme", status: "unknown" });
    expect(res.status).toBe(400);
  });

  it("POST /orders accepts valid datetime fields", async () => {
    db.purchaseOrder.create.mockResolvedValue(ORDER);

    const res = await request(app(db)).post("/orders")
      .send({ supplierName: "Acme", orderDate: ISO, expectedDate: ISO });
    expect(res.status).toBe(201);
  });

  it("GET /orders/:id returns order with items", async () => {
    db.purchaseOrder.findUnique.mockResolvedValue({ ...ORDER, items: [] });

    const res = await request(app(db)).get("/orders/o1");
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe("o1");
    expect(Array.isArray(res.body.order.items)).toBe(true);
  });

  it("GET /orders/:id returns 404 when not found", async () => {
    db.purchaseOrder.findUnique.mockResolvedValue(null);

    const res = await request(app(db)).get("/orders/nonexistent");
    expect(res.status).toBe(404);
  });

  it("PATCH /orders/:id updates status", async () => {
    db.purchaseOrder.update.mockResolvedValue({ ...ORDER, status: "received" });

    const res = await request(app(db)).patch("/orders/o1").send({ status: "received" });
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("received");
  });

  it("DELETE /orders/:id deletes order", async () => {
    db.purchaseOrder.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/orders/o1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("POST /orders/:id/items adds a line item", async () => {
    db.purchaseOrderItem.create.mockResolvedValue({
      id: "item1", purchaseOrderId: "o1", productName: "Widget",
      quantity: 5, unitCost: 10, totalCost: 50, productId: null,
    });

    const res = await request(app(db)).post("/orders/o1/items")
      .send({ productName: "Widget", quantity: 5, unitCost: 10, totalCost: 50 });
    expect(res.status).toBe(201);
    expect(res.body.item.productName).toBe("Widget");
  });

  it("POST /orders/:id/items rejects missing productName", async () => {
    const res = await request(app(db)).post("/orders/o1/items")
      .send({ quantity: 5, unitCost: 10, totalCost: 50 });
    expect(res.status).toBe(400);
  });

  it("POST /orders/:id/items rejects zero quantity", async () => {
    const res = await request(app(db)).post("/orders/o1/items")
      .send({ productName: "Widget", quantity: 0, unitCost: 10, totalCost: 0 });
    expect(res.status).toBe(400);
  });

  it("DELETE /orders/:id/items/:itemId removes line item", async () => {
    db.purchaseOrderItem.delete.mockResolvedValue({});

    const res = await request(app(db)).delete("/orders/o1/items/item1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
