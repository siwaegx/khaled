-- Add isAdmin to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Add 'manager' enum value (must commit before it can be used in UPDATE below)
ALTER TYPE "OrgRole" ADD VALUE IF NOT EXISTS 'manager';
