-- Migration: notifications, webhooks, webhook_deliveries, dashboardConfig

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "dashboardConfig" JSONB;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "orgId"      TEXT,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "body"       TEXT,
  "entityType" TEXT,
  "entityId"   TEXT,
  "href"       TEXT,
  "readAt"     TIMESTAMPTZ,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

CREATE TABLE IF NOT EXISTS "org_webhooks" (
  "id"             TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "url"            TEXT NOT NULL,
  "events"         JSONB NOT NULL DEFAULT '[]',
  "secret"         TEXT,
  "isActive"       BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id"         TEXT PRIMARY KEY,
  "webhookId"  TEXT NOT NULL REFERENCES "org_webhooks"("id") ON DELETE CASCADE,
  "event"      TEXT NOT NULL,
  "payload"    JSONB NOT NULL,
  "statusCode" INTEGER,
  "error"      TEXT,
  "sentAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "webhook_deliveries_webhookId_sentAt_idx" ON "webhook_deliveries"("webhookId", "sentAt");
