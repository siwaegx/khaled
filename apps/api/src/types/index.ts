import type { PrismaClient as TenantPrismaClient } from "../generated/tenant";

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantDb?: TenantPrismaClient;
    }
  }
}
