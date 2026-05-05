import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../middleware/errorHandler";

export const router = Router();

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

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res, next) => {
  try {
    const db = req.tenantDb!;
    const [totalProducts, totalWarehouses, totalOrders, productsByStatus] = await Promise.all([
      db.product.count(),
      db.warehouse.count(),
      db.purchaseOrder.count(),
      db.product.groupBy({ by: ["status"], _count: { id: true } }),
    ]);
    res.json({ totalProducts, totalWarehouses, totalOrders, productsByStatus });
  } catch (err) { next(err); }
});

// ─── Products ────────────────────────────────────────────────────────────────

router.get("/products", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query["limit"] ?? "50"))));
    const [products, total] = await Promise.all([
      req.tenantDb!.product.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { name: "asc" },
        include: { stockLevels: { include: { warehouse: { select: { id: true, name: true } } } } },
      }),
      req.tenantDb!.product.count(),
    ]);
    res.json({ products, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/products", async (req, res, next) => {
  try {
    const data = productSchema.parse(req.body);
    const product = await req.tenantDb!.product.create({ data });
    res.status(201).json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/products/:id", async (req, res, next) => {
  try {
    const data = productSchema.partial().parse(req.body);
    const product = await req.tenantDb!.product.update({ where: { id: req.params["id"]! }, data });
    res.json({ product });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/products/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.product.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── Warehouses ───────────────────────────────────────────────────────────────

router.get("/warehouses", async (req, res, next) => {
  try {
    const warehouses = await req.tenantDb!.warehouse.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { stockLevels: true } } },
    });
    res.json({ warehouses });
  } catch (err) { next(err); }
});

router.post("/warehouses", async (req, res, next) => {
  try {
    const data = warehouseSchema.parse(req.body);
    const warehouse = await req.tenantDb!.warehouse.create({ data });
    res.status(201).json({ warehouse });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/warehouses/:id", async (req, res, next) => {
  try {
    const data = warehouseSchema.partial().parse(req.body);
    const warehouse = await req.tenantDb!.warehouse.update({ where: { id: req.params["id"]! }, data });
    res.json({ warehouse });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/warehouses/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.warehouse.delete({ where: { id: req.params["id"]! } });
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

    const stock = await req.tenantDb!.stockLevel.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity, minQuantity: minQuantity ?? 0 },
      update: { quantity, ...(minQuantity !== undefined ? { minQuantity } : {}) },
    });
    res.json({ stock });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// ─── Purchase Orders ──────────────────────────────────────────────────────────

const orderItemSchema = z.object({
  productName: z.string().min(1),
  quantity:    z.number().positive(),
  unitCost:    z.number().nonnegative(),
  totalCost:   z.number().nonnegative(),
  productId:   z.string().optional(),
});

router.get("/orders", async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(String(req.query["page"]  ?? "1")));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "20"))));
    const [orders, total] = await Promise.all([
      req.tenantDb!.purchaseOrder.findMany({
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } } },
      }),
      req.tenantDb!.purchaseOrder.count(),
    ]);
    res.json({ orders, total, page, limit });
  } catch (err) { next(err); }
});

router.post("/orders", async (req, res, next) => {
  try {
    const data = purchaseOrderSchema.parse(req.body);
    const order = await req.tenantDb!.purchaseOrder.create({
      data: {
        ...data,
        orderDate:    data.orderDate    ? new Date(data.orderDate)    : null,
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      },
    });
    res.status(201).json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.patch("/orders/:id", async (req, res, next) => {
  try {
    const data = purchaseOrderSchema.partial().parse(req.body);
    const order = await req.tenantDb!.purchaseOrder.update({
      where: { id: req.params["id"]! },
      data: {
        ...data,
        orderDate:    data.orderDate    !== undefined ? (data.orderDate    ? new Date(data.orderDate)    : null) : undefined,
        expectedDate: data.expectedDate !== undefined ? (data.expectedDate ? new Date(data.expectedDate) : null) : undefined,
      },
    });
    res.json({ order });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.get("/orders/:id", async (req, res, next) => {
  try {
    const order = await req.tenantDb!.purchaseOrder.findUnique({
      where: { id: req.params["id"]! },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!order) throw new AppError(404, "Order not found");
    res.json({ order });
  } catch (err) { next(err); }
});

router.delete("/orders/:id", async (req, res, next) => {
  try {
    await req.tenantDb!.purchaseOrder.delete({ where: { id: req.params["id"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post("/orders/:id/items", async (req, res, next) => {
  try {
    const data = orderItemSchema.parse(req.body);
    const item = await req.tenantDb!.purchaseOrderItem.create({
      data: { purchaseOrderId: req.params["id"]!, ...data },
    });
    res.status(201).json({ item });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

router.delete("/orders/:id/items/:itemId", async (req, res, next) => {
  try {
    await req.tenantDb!.purchaseOrderItem.delete({ where: { id: req.params["itemId"]! } });
    res.json({ success: true });
  } catch (err) { next(err); }
});
