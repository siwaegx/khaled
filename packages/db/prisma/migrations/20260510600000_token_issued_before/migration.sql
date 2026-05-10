-- AlterTable: add tokenIssuedBefore to OrgMember for JWT invalidation on role change
ALTER TABLE "org_members" ADD COLUMN "tokenIssuedBefore" TIMESTAMP(3);
