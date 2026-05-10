import { Pool } from "pg";
import { prisma } from "../lib/prisma";
import { getTenantClient } from "../lib/tenantDb";

function buildTenantDbUrl(baseUrl: string, dbName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${dbName}`;
  return url.toString();
}

function slugToDbName(slug: string): string {
  return `biz360_${slug.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
}

export async function provisionTenantDb(orgId: string, orgSlug: string): Promise<string> {
  const baseUrl = process.env.DATABASE_URL!;
  const dbName = slugToDbName(orgSlug);
  const dbUrl = buildTenantDbUrl(baseUrl, dbName);

  // Create the database via a raw admin connection
  const adminPool = new Pool({ connectionString: baseUrl });
  try {
    await adminPool.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    // Tolerate "already exists" so re-runs are safe
    if (!msg.includes("already exists")) throw err;
  } finally {
    await adminPool.end();
  }

  // Bootstrap tenant schema
  const tenantClient = getTenantClient(dbUrl);

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_tenant_meta" (
      "key"        TEXT PRIMARY KEY,
      "value"      TEXT NOT NULL,
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "activity_logs" (
      "id"        TEXT PRIMARY KEY,
      "userId"    TEXT NOT NULL,
      "action"    TEXT NOT NULL,
      "entity"    TEXT NOT NULL,
      "entityId"  TEXT,
      "meta"      JSONB,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // CRM enums (safe to run multiple times via DO block)
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LeadStatus" AS ENUM ('new','contacted','qualified','converted','lost');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "DealStatus" AS ENUM ('prospect','qualified','proposal','negotiation','won','lost');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "crm_customers" (
      "id"        TEXT PRIMARY KEY,
      "name"      TEXT NOT NULL,
      "email"     TEXT,
      "phone"     TEXT,
      "company"   TEXT,
      "address"   TEXT,
      "notes"     TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "crm_leads" (
      "id"         TEXT PRIMARY KEY,
      "name"       TEXT NOT NULL,
      "email"      TEXT,
      "phone"      TEXT,
      "company"    TEXT,
      "status"     "LeadStatus" NOT NULL DEFAULT 'new',
      "source"     TEXT,
      "notes"      TEXT,
      "assignedTo" TEXT,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "crm_leads_status_idx" ON "crm_leads"("status")`
  );

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "crm_deals" (
      "id"         TEXT PRIMARY KEY,
      "title"      TEXT NOT NULL,
      "value"      DOUBLE PRECISION,
      "currency"   TEXT NOT NULL DEFAULT 'USD',
      "status"     "DealStatus" NOT NULL DEFAULT 'prospect',
      "customerId" TEXT REFERENCES "crm_customers"("id") ON DELETE SET NULL,
      "assignedTo" TEXT,
      "closeDate"  TIMESTAMPTZ,
      "notes"      TEXT,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "crm_deals_status_idx" ON "crm_deals"("status")`
  );

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "crm_companies" (
      "id"        TEXT PRIMARY KEY,
      "name"      TEXT NOT NULL,
      "industry"  TEXT,
      "website"   TEXT,
      "phone"     TEXT,
      "email"     TEXT,
      "address"   TEXT,
      "notes"     TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "crm_contacts" (
      "id"        TEXT PRIMARY KEY,
      "companyId" TEXT NOT NULL REFERENCES "crm_companies"("id") ON DELETE CASCADE,
      "name"      TEXT NOT NULL,
      "position"  TEXT,
      "email"     TEXT,
      "phone"     TEXT,
      "notes"     TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "crm_contacts_companyId_idx" ON "crm_contacts"("companyId")`
  );

  // ── Inventory ──────────────────────────────────────────────────────────────
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "ProductStatus"         AS ENUM ('active','inactive','discontinued');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "PurchaseOrderStatus"   AS ENUM ('draft','ordered','partial','received','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inv_products" (
      "id"          TEXT PRIMARY KEY,
      "name"        TEXT NOT NULL,
      "sku"         TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "category"    TEXT,
      "unitPrice"   DOUBLE PRECISION,
      "costPrice"   DOUBLE PRECISION,
      "unit"        TEXT NOT NULL DEFAULT 'unit',
      "status"      "ProductStatus" NOT NULL DEFAULT 'active',
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "inv_products_status_idx" ON "inv_products"("status")`
  );
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inv_warehouses" (
      "id"          TEXT PRIMARY KEY,
      "name"        TEXT NOT NULL,
      "location"    TEXT,
      "description" TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inv_stock_levels" (
      "id"          TEXT PRIMARY KEY,
      "productId"   TEXT NOT NULL REFERENCES "inv_products"("id") ON DELETE CASCADE,
      "warehouseId" TEXT NOT NULL REFERENCES "inv_warehouses"("id") ON DELETE CASCADE,
      "quantity"    DOUBLE PRECISION NOT NULL DEFAULT 0,
      "minQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE("productId","warehouseId")
    )
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inv_purchase_orders" (
      "id"           TEXT PRIMARY KEY,
      "supplierName" TEXT NOT NULL,
      "status"       "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
      "totalAmount"  DOUBLE PRECISION,
      "notes"        TEXT,
      "orderDate"    TIMESTAMPTZ,
      "expectedDate" TIMESTAMPTZ,
      "receivedDate" TIMESTAMPTZ,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inv_purchase_order_items" (
      "id"              TEXT PRIMARY KEY,
      "purchaseOrderId" TEXT NOT NULL REFERENCES "inv_purchase_orders"("id") ON DELETE CASCADE,
      "productId"       TEXT REFERENCES "inv_products"("id") ON DELETE SET NULL,
      "productName"     TEXT NOT NULL,
      "quantity"        DOUBLE PRECISION NOT NULL,
      "unitCost"        DOUBLE PRECISION NOT NULL,
      "totalCost"       DOUBLE PRECISION NOT NULL,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Accounting ─────────────────────────────────────────────────────────────
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "InvoiceStatus" AS ENUM ('draft','sent','paid','overdue','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "acc_invoices" (
      "id"           TEXT PRIMARY KEY,
      "number"       TEXT NOT NULL UNIQUE,
      "customerName" TEXT NOT NULL,
      "customerId"   TEXT,
      "status"       "InvoiceStatus" NOT NULL DEFAULT 'draft',
      "subtotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
      "tax"          DOUBLE PRECISION NOT NULL DEFAULT 0,
      "total"        DOUBLE PRECISION NOT NULL DEFAULT 0,
      "notes"        TEXT,
      "issueDate"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "dueDate"      TIMESTAMPTZ,
      "paidDate"     TIMESTAMPTZ,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "acc_invoices_status_idx" ON "acc_invoices"("status")`
  );
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "acc_invoice_items" (
      "id"          TEXT PRIMARY KEY,
      "invoiceId"   TEXT NOT NULL REFERENCES "acc_invoices"("id") ON DELETE CASCADE,
      "description" TEXT NOT NULL,
      "quantity"    DOUBLE PRECISION NOT NULL DEFAULT 1,
      "unitPrice"   DOUBLE PRECISION NOT NULL,
      "amount"      DOUBLE PRECISION NOT NULL,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "acc_expenses" (
      "id"          TEXT PRIMARY KEY,
      "category"    TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "amount"      DOUBLE PRECISION NOT NULL,
      "currency"    TEXT NOT NULL DEFAULT 'USD',
      "date"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "reference"   TEXT,
      "notes"       TEXT,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "acc_expenses_category_idx" ON "acc_expenses"("category")`
  );

  // ── HR ─────────────────────────────────────────────────────────────────────
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "EmployeeStatus" AS ENUM ('active','inactive','terminated');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LeaveType"   AS ENUM ('annual','sick','unpaid','maternity','paternity','other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "LeaveStatus" AS ENUM ('pending','approved','rejected','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hr_employees" (
      "id"              TEXT PRIMARY KEY,
      "name"            TEXT NOT NULL,
      "email"           TEXT,
      "phone"           TEXT,
      "position"        TEXT,
      "department"      TEXT,
      "salary"          DOUBLE PRECISION,
      "status"          "EmployeeStatus" NOT NULL DEFAULT 'active',
      "hireDate"        TIMESTAMPTZ,
      "terminationDate" TIMESTAMPTZ,
      "notes"           TEXT,
      "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hr_leave_requests" (
      "id"         TEXT PRIMARY KEY,
      "employeeId" TEXT NOT NULL REFERENCES "hr_employees"("id") ON DELETE CASCADE,
      "type"       "LeaveType"   NOT NULL DEFAULT 'annual',
      "status"     "LeaveStatus" NOT NULL DEFAULT 'pending',
      "startDate"  TIMESTAMPTZ NOT NULL,
      "endDate"    TIMESTAMPTZ NOT NULL,
      "days"       DOUBLE PRECISION NOT NULL,
      "reason"     TEXT,
      "notes"      TEXT,
      "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Projects ───────────────────────────────────────────────────────────────
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "ProjectStatus" AS ENUM ('planning','active','on_hold','completed','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "TaskStatus"   AS ENUM ('todo','in_progress','review','done','cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "TaskPriority" AS ENUM ('low','medium','high','urgent');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "proj_projects" (
      "id"          TEXT PRIMARY KEY,
      "name"        TEXT NOT NULL,
      "description" TEXT,
      "status"      "ProjectStatus" NOT NULL DEFAULT 'planning',
      "startDate"   TIMESTAMPTZ,
      "endDate"     TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "proj_tasks" (
      "id"          TEXT PRIMARY KEY,
      "projectId"   TEXT REFERENCES "proj_projects"("id") ON DELETE SET NULL,
      "title"       TEXT NOT NULL,
      "description" TEXT,
      "status"      "TaskStatus"   NOT NULL DEFAULT 'todo',
      "priority"    "TaskPriority" NOT NULL DEFAULT 'medium',
      "assignedTo"  TEXT,
      "dueDate"     TIMESTAMPTZ,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // ── Calendar ───────────────────────────────────────────────────────────────
  await tenantClient.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "CalendarEventType" AS ENUM ('meeting','deadline','reminder','task','other');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
  `);
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "cal_events" (
      "id"          TEXT PRIMARY KEY,
      "title"       TEXT NOT NULL,
      "description" TEXT,
      "startAt"     TIMESTAMPTZ NOT NULL,
      "endAt"       TIMESTAMPTZ NOT NULL,
      "allDay"      BOOLEAN NOT NULL DEFAULT FALSE,
      "type"        "CalendarEventType" NOT NULL DEFAULT 'meeting',
      "entityType"  TEXT,
      "entityId"    TEXT,
      "color"       TEXT,
      "createdBy"   TEXT NOT NULL,
      "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "cal_events_startAt_endAt_idx" ON "cal_events"("startAt","endAt")`
  );

  // ── Documents ──────────────────────────────────────────────────────────────
  await tenantClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "documents" (
      "id"           TEXT PRIMARY KEY,
      "entityType"   TEXT NOT NULL,
      "entityId"     TEXT NOT NULL,
      "name"         TEXT NOT NULL,
      "originalName" TEXT NOT NULL,
      "mimeType"     TEXT NOT NULL,
      "size"         INTEGER NOT NULL,
      "storagePath"  TEXT NOT NULL,
      "uploadedBy"   TEXT NOT NULL,
      "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await tenantClient.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "documents_entity_idx" ON "documents"("entityType","entityId")`
  );

  // Write tenant meta record
  await tenantClient.tenantMeta.upsert({
    where: { key: "org_id" },
    create: { key: "org_id", value: orgId },
    update: { value: orgId },
  });

  // Persist dbUrl on the organization
  await prisma.organization.update({
    where: { id: orgId },
    data: { dbUrl },
  });

  return dbUrl;
}

export async function deprovisionTenantDb(orgId: string): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { slug: true },
  });
  if (!org) return;

  const dbName = slugToDbName(org.slug);
  const adminPool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    // Terminate active connections first
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [dbName]);
    await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  } finally {
    await adminPool.end();
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { dbUrl: null },
  });
}
