-- Add new specialized org roles
-- Note: ALTER TYPE ADD VALUE cannot run inside a transaction in PostgreSQL,
-- so this migration uses IF NOT EXISTS to be safe on re-runs.

ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'sales_leader';
ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'inventory_manager';
ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'engineer';
ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'service_agent';
