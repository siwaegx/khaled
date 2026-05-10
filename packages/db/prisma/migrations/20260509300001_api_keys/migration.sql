-- Phase 24: API key management for programmatic access
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"             TEXT        NOT NULL,
  "organizationId" TEXT        NOT NULL,
  "name"           TEXT        NOT NULL,
  "keyHash"        TEXT        NOT NULL,
  "prefix"         TEXT        NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastUsedAt"     TIMESTAMPTZ,
  "isActive"       BOOLEAN     NOT NULL DEFAULT TRUE,

  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_keyHash_key" UNIQUE ("keyHash"),
  CONSTRAINT "api_keys_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "api_keys_organizationId_idx" ON "api_keys"("organizationId");
