-- DB-003: Migrate monetary Float columns to NUMERIC(20,4) for precision
-- Run this against each tenant database (biz360_<slug>) after deploying the new schema.
-- The Prisma tenant client must be regenerated with `prisma generate` after this migration.

ALTER TABLE "crm_deals"
  ALTER COLUMN "value" TYPE NUMERIC(20,4) USING value::NUMERIC;

ALTER TABLE "inv_products"
  ALTER COLUMN "unit_price"  TYPE NUMERIC(20,4) USING unit_price::NUMERIC,
  ALTER COLUMN "cost_price"  TYPE NUMERIC(20,4) USING cost_price::NUMERIC;

ALTER TABLE "inv_purchase_orders"
  ALTER COLUMN "total_amount" TYPE NUMERIC(20,4) USING total_amount::NUMERIC;

ALTER TABLE "inv_purchase_order_items"
  ALTER COLUMN "quantity"   TYPE NUMERIC(20,4) USING quantity::NUMERIC,
  ALTER COLUMN "unit_cost"  TYPE NUMERIC(20,4) USING unit_cost::NUMERIC,
  ALTER COLUMN "total_cost" TYPE NUMERIC(20,4) USING total_cost::NUMERIC;

ALTER TABLE "acc_invoices"
  ALTER COLUMN "subtotal" TYPE NUMERIC(20,4) USING subtotal::NUMERIC,
  ALTER COLUMN "tax"      TYPE NUMERIC(20,4) USING tax::NUMERIC,
  ALTER COLUMN "total"    TYPE NUMERIC(20,4) USING total::NUMERIC;

ALTER TABLE "acc_invoice_items"
  ALTER COLUMN "quantity"   TYPE NUMERIC(20,4) USING quantity::NUMERIC,
  ALTER COLUMN "unit_price" TYPE NUMERIC(20,4) USING unit_price::NUMERIC,
  ALTER COLUMN "amount"     TYPE NUMERIC(20,4) USING amount::NUMERIC;

ALTER TABLE "acc_expenses"
  ALTER COLUMN "amount" TYPE NUMERIC(20,4) USING amount::NUMERIC;

ALTER TABLE "hr_employees"
  ALTER COLUMN "salary" TYPE NUMERIC(20,4) USING salary::NUMERIC;
