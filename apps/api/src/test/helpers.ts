import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../middleware/errorHandler";
import type { JwtPayload } from "../types";

export type MockTenantDb = {
  lead: Record<string, ReturnType<typeof vi.fn>>;
  customer: Record<string, ReturnType<typeof vi.fn>>;
  deal: Record<string, ReturnType<typeof vi.fn>>;
};

export function makeApp(
  router: express.Router,
  user: JwtPayload = { userId: "u1", orgId: "org1", role: "owner" },
  tenantDb?: MockTenantDb
) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use((req, _res, next) => {
    req.user = user;
    if (tenantDb) req.tenantDb = tenantDb as never;
    next();
  });

  app.use("/", router);
  app.use(errorHandler);
  return app;
}

export function makeTenantDb(): MockTenantDb {
  return {
    lead: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  };
}
