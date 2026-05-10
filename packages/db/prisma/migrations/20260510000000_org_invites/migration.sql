CREATE TABLE IF NOT EXISTS "org_invites" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "email"          TEXT         NOT NULL,
  "role"           "OrgRole"    NOT NULL DEFAULT 'member',
  "token"          TEXT         NOT NULL,
  "invitedBy"      TEXT         NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "acceptedAt"     TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "org_invites_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "org_invites_token_key"     UNIQUE ("token"),
  CONSTRAINT "org_invites_org_fkey"      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_invites_inviter_fkey"  FOREIGN KEY ("invitedBy")      REFERENCES "users"("id")         ON DELETE RESTRICT ON UPDATE CASCADE
);
