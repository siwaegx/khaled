-- Contacts-as-customers migration
-- CrmCompany (contacts module) is now the single source of truth for customers.
-- Deals link to crm_companies instead of crm_customers.
-- Run against each tenant database (biz360_<slug>).

-- 1. Add companyId to deals, referencing crm_companies
ALTER TABLE "crm_deals"
  ADD COLUMN IF NOT EXISTS "company_id" TEXT REFERENCES "crm_companies"("id") ON DELETE SET NULL;

-- 2. Remove old customer reference from deals
ALTER TABLE "crm_deals"
  DROP CONSTRAINT IF EXISTS "crm_deals_customerId_fkey",
  DROP COLUMN IF EXISTS "customer_id";

-- 3. crm_customers table is kept but no longer used by the app.
--    Drop it only after confirming no data needs to be migrated:
--    DROP TABLE IF EXISTS "crm_customers";
