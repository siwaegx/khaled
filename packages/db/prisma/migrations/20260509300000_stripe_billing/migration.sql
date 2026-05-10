-- Phase 20/21: Add stripeCustomerId to organizations for Stripe billing
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
