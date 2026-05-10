ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "moduleAccess" JSONB;

CREATE TABLE IF NOT EXISTS "org_teams" (
  "id"             TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  "moduleKey"      TEXT         NOT NULL,
  "name"           TEXT         NOT NULL,
  "leaderId"       TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "org_teams_pkey"    PRIMARY KEY ("id"),
  CONSTRAINT "org_teams_org_fk"  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_teams_lead_fk" FOREIGN KEY ("leaderId")       REFERENCES "org_members"("id")   ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "org_team_members" (
  "id"       TEXT NOT NULL,
  "teamId"   TEXT NOT NULL,
  "memberId" TEXT NOT NULL,

  CONSTRAINT "org_team_members_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "org_team_members_team_fk"   FOREIGN KEY ("teamId")   REFERENCES "org_teams"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_team_members_member_fk" FOREIGN KEY ("memberId") REFERENCES "org_members"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_team_members_unique"    UNIQUE ("teamId", "memberId")
);
