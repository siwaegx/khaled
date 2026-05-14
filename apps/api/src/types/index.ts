import type { PrismaClient as TenantPrismaClient } from "../generated/tenant";
import type { HookService } from "@business360/module-sdk";

export interface JwtPayload {
  userId: string;
  orgId: string;
  role: string;
  isAdmin: boolean;
  impersonated?: boolean;
  /** Standard JWT issued-at claim (seconds since epoch) — set by jsonwebtoken automatically */
  iat?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenantDb?: TenantPrismaClient;
      hookService?: HookService;
      orgCurrency?: string;
    }
  }
}
