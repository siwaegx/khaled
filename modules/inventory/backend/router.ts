import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AppError, requireRole } from "@business360/module-sdk";

export const router = Router();

// Members are read-only; managers can mutate
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
  groupBy:   (a: unknown) => Promise<unknown[]>;
  upsert:    (a: unknown) => Promise<unknown>;
};

type InvDb = {
  product:           DbModel;
  warehouse:         DbModel;
  stockLevel:        DbModel;
  purchaseOrder:     DbModel;
  purchaseOrderItem: DbModel;
};

function db(req: Request): InvDb {
  return req.tenantDb as unknown as InvDb;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name:        z.string().min(1),
  sku:         z.string().min(1),
  description: z.string().optional(),
  category:    z.string().optional(),
  unitPrice:   z.number().nonnegative().optional(),
  costPrice:   z.number().nonnegative().optional(),
  unit:        z.string().optional(),
  status:      z.enum(["active", "inactive", "discontinued"]).optional(),
});

const warehouseSchema = z.object({
  name:        z.string().min(1),
  location:    z.string().optional(),
  description: z.string().optional(),
});

const purchaseOrderSchema = z.object({
  supplierName: z.string().min(1),
  status:       z.enum(["draft", "ordered", "partial", "received", "cancelled"]).optional(),
  totalAmount:  z.number().nonnegative().optional(),
  notes:        z.string().optional(),
  orderDate:    z.string().datetime({ offset: true }).optional(),
  expectedDate: z.string().datetime({ offset: true }).optional(),
});

const orderItemSchema = z.object({
  productName: z.string().min(1),
  quantity:    z.number().positive(),
  unitCost:    z.number().nonnegative(),
  totalCost:   z.number().nonnegative(),
  productId:   z.string().optional(),
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const d = db(req);
    const [totalProducts, totalWarehouses, totalOrders, productsByStatus] = await Promise.all([
      d.product.count(),
      d.warehouse.count(),
      d.purchaseOrder.count(),
      d.product.groupBy({ by: ["status"], _count: { id: true } }),
    ]);
    res.json({ totalProducts, totalWarehouses, totalOrders, productsByStatus });
  } catch (err) { next(err); }
});

// ─── Products ─────────────────────────────────────────────────────────────────

router.get("/products", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const [products, total] = await Promise.all([
      db(req).product.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { name: "asc" },
        include: { stockLevels: { include: { warehouse: { select: { id: true, name: true } } } } },
      }),
      db(req).product.count(),
    ]);
    res.json({ products, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/products", async (req, res, next) => {
  try {
    const data    = productSchema.parse(req.body);
    const product = await db(req).product.create({ data });
    res.status(201).json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/products/:id", async (req, res, next) => {
  try {
    const data    = productSchema.partial().parse(req.body);
    const product = await db(req).product.update({ where: { id: req.params["id"]! }, data });
    res.json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    await db(req).product.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Warehouses ───────────────────────────────────────────────────────────────

router.get("/warehouses", async (req, res, next) => {
  try {
    const warehouses = await db(req).warehouse.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { stockLevels: true } } },
    });
    res.json({ warehouses });
  } catch (err) { next(err); }
});

router.post("/warehouses", async (req, res, next) => {
  try {
    const data      = warehouseSchema.parse(req.body);
    const warehouse = await db(req).warehouse.create({ data });
    res.status(201).json({ warehouse });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/warehouses/:id", async (req, res, next) => {
  try {
    const data      = warehouseSchema.partial().parse(req.body);
    const warehouse = await db(req).warehouse.update({ where: { id: req.params["id"]! }, data });
    res.json({ warehouse });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/warehouses/:id", async (req, res, next) => {
  try {
    await db(req).warehouse.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Stock adjustment ─────────────────────────────────────────────────────────

router.post("/stock/adjust", async (req, res, next) => {
  try {
    const { productId, warehouseId, quantity, minQuantity } = z.object({
      productId:   z.string(),
      warehouseId: z.string(),
      quantity:    z.number(),
      minQuantity: z.number().nonnegative().optional(),
    }).parse(req.body);

    const stock = await db(req).stockLevel.upsert({
      where:  { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity, minQuantity: minQuantity ?? 0 },
      update: { quantity, ...(minQuantity !== undefined ? { minQuantity } : {}) },
    });
    res.json({ stock });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────

router.get("/orders", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
    const [orders, total] = await Promise.all([
      db(req).purchaseOrder.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      db(req).purchaseOrder.count(),
    ]);
    res.json({ orders, total, page, limit });
  } catch (err) { next(err); }
});

router.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await db(req).purchaseOrder.findUnique({
      where:   { id: req.params["id"]! },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!order) throw new AppError(404, "Order not found");
    res.json({ order });
  } catch (err) { next(err); }
});

router.post("/orders", async (req, res, next) => {
  try {
    const data  = purchaseOrderSchema.parse(req.body);
    const order = await db(req).purchaseOrder.create({
      data: {
        ...data,
        orderDate:    data.orderDate    ? new Date(data.orderDate)    : null,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      },
    });
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.patch("/orders/:id", async (req, res, next) => {
  try {
    const data  = purchaseOrderSchema.partial().parse(req.body);
    const order = await db(req).purchaseOrder.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        orderDate:    data.orderDate    !== undefined ? (data.orderDate    ? new Date(data.orderDate)    : null) : undefined,
        expectedDate: data.expectedDate !== undefined ? (data.expectedDate ? new Date(data.expectedDate) : null) : undefined,
      },
    });
    res.json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/orders/:id", async (req, res, next) => {
  try {
    await db(req).purchaseOrder.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/orders/:id/items", async (req, res, next) => {
  try {
    const data = orderItemSchema.parse(req.body);
    const item = await db(req).purchaseOrderItem.create({
      data: { purchaseOrderId: req.params["id"]!, ...data },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message || "Validation error"));
    else next(err);
  }
});

router.delete("/orders/:id/items/:itemId", async (req, res, next) => {
  try {
    await db(req).purchaseOrderItem.delete({ where: { id: req.params["itemId"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
