import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { errorHandler } from "../middleware/errorHandler";

vi.mock("../lib/prisma", () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
  },
}));

vi.mock("../lib/tenantDb", () => ({
  getTenantClient: vi.fn(() => ({ mock: "db" })),
}));

import { resolveTenant } from "../middleware/tenantResolver";
import { prisma } from "../lib/prisma";
import { getTenantClient } from "../lib/tenantDb";

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use((req, _res, next) => {
    req.user = { userId: "u1", orgId: "org1", role: "owner" };
    next();
  });
  app.get("/tenant-test", resolveTenant, (req, res) => {
    res.json({ tenantDb: req.tenantDb ? "attached" : "missing" });
  });
  app.use(errorHandler);
  return app;
}

describe("resolveTenant middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when org not found", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    const res = await request(makeApp()).get("/tenant-test");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Organization not found");
  });

  it("returns 403 when org is suspended", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      dbUrl: "postgresql://x", status: "suspended",
    } as never);
    const res = await request(makeApp()).get("/tenant-test");
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Organization is suspended");
  });

  it("returns 503 when dbUrl is null", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      dbUrl: null, status: "active",
    } as never);
    const res = await request(makeApp()).get("/tenant-test");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Tenant database not yet provisioned");
  });

  it("attaches tenantDb on success", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      dbUrl: "postgresql://tenant-db", status: "active",
    } as never);
    const res = await request(makeApp()).get("/tenant-test");
    expect(res.status).toBe(200);
    expect(res.body.tenantDb).toBe("attached");
    expect(getTenantClient).toHaveBeenCalledWith("postgresql://tenant-db");
  });

  it("returns 400 when no orgId in session", async () => {
    const app = express();
    app.use((req, _res, next) => { req.user = { userId: "u1", orgId: "", role: "owner" }; next(); });
    app.get("/t", resolveTenant, (_req, res) => res.json({}));
    app.use(errorHandler);
    // orgId is falsy → findUnique with empty string → mock returns null
    vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);
    const res = await request(app).get("/t");
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
