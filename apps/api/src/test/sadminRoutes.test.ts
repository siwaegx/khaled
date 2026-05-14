import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { makeApp } from "./helpers";
import { errorHandler } from "../middleware/errorHandler";
import { requireSaasAdmin } from "../middleware/requireSaasAdmin";

// ── Mock requireAuth — always admits an isAdmin user ─────────────────────────
vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (
    req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } },
    _res: unknown,
    next: () => void,
  ) => {
    req.user = { userId: "admin1", orgId: "org1", role: "owner", isAdmin: true };
    next();
  },
}));

// ── Mock prisma ───────────────────────────────────────────────────────────────
vi.mock("../lib/prisma", () => ({
  prisma: {
    organization: {
      count:    vi.fn(),
      groupBy:  vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update:   vi.fn(),
    },
    user: {
      count:    vi.fn(),
      findMany: vi.fn(),
      update:   vi.fn(),
    },
    moduleSubmission: {
      count:      vi.fn(),
      findMany:   vi.fn(),
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
    marketplaceModule: {
      create:   vi.fn(),
      findMany: vi.fn(),
      update:   vi.fn(),
      delete:   vi.fn(),
    },
    userSession: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: vi.fn(),
  },
}));

// ── Mock tenantDb ─────────────────────────────────────────────────────────────
vi.mock("../lib/tenantDb", () => ({
  getTenantClient: vi.fn(() => ({
    $queryRaw:        vi.fn().mockResolvedValue([{ tablename: "leads" }]),
    $queryRawUnsafe:  vi.fn().mockResolvedValue([{ id: "row1" }]),
  })),
}));

import { sadminRouter, platformSettings, DEFAULT_PLAN_CONFIGS } from "../routes/sadmin";
import { prisma } from "../lib/prisma";

// ── Helper — admin app ────────────────────────────────────────────────────────
function app() {
  return makeApp(sadminRouter, {
    userId: "admin1",
    orgId:  "org1",
    role:   "owner",
    isAdmin: true,
  });
}

// ── Shared fixture data ───────────────────────────────────────────────────────
const ORG = {
  id: "org1", name: "ACME", slug: "acme", plan: "starter",
  status: "active", trialEnds: null, createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), dbUrl: null,
  _count: { members: 2, modules: 1 },
  members: [],
  modules: [],
};

const USER = {
  id: "u1", name: "Alice", email: "alice@test.com", isAdmin: false,
  createdAt: new Date().toISOString(),
  memberships: [{ role: "owner", organization: { id: "org1", name: "ACME", plan: "starter", status: "active" } }],
};

const SUBMISSION = {
  id: "sub1", key: "my-module", name: "My Module", version: "1.0.0",
  category: "community", description: "Great module", repoUrl: "https://github.com/x/y",
  contactEmail: "dev@test.com", status: "pending", reviewNote: null,
  submittedAt: new Date().toISOString(), reviewedAt: null,
  developer: {
    id: "dev1",
    user: { id: "u2", name: "Bob", email: "bob@test.com" },
  },
};

const MARKETPLACE_MODULE = {
  id: "mm1", submissionId: "sub1", key: "my-module", name: "My Module",
  version: "1.0.0", category: "community", description: "Great module",
  author: "Bob", repoUrl: "https://github.com/x/y",
  price: 0, billing: "free", rating: 0, installCount: 0,
  publishedAt: new Date().toISOString(), isActive: true,
  submission: { developer: { user: { id: "u2", name: "Bob", email: "bob@test.com" } } },
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH GUARD
// ═══════════════════════════════════════════════════════════════════════════════

describe("requireSaasAdmin guard", () => {
  it("blocks non-admin users with 403", async () => {
    const mini = express();
    mini.use(express.json());
    mini.use(cookieParser());
    mini.use((req: express.Request, _res, next) => {
      (req as never as { user: { isAdmin: boolean } }).user = { isAdmin: false };
      next();
    });
    mini.use(requireSaasAdmin);
    mini.get("/", (_req, res) => res.json({ ok: true }));
    mini.use(errorHandler);

    const res = await request(mini).get("/");
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it("passes admin users through", async () => {
    const mini = express();
    mini.use(express.json());
    mini.use(cookieParser());
    mini.use((req: express.Request, _res, next) => {
      (req as never as { user: { isAdmin: boolean } }).user = { isAdmin: true };
      next();
    });
    mini.use(requireSaasAdmin);
    mini.get("/", (_req, res) => res.json({ ok: true }));
    mini.use(errorHandler);

    const res = await request(mini).get("/");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /stats
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns platform stats", async () => {
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(10);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(25);
    vi.mocked(prisma.organization.groupBy).mockResolvedValueOnce(
      [{ plan: "starter", _count: { id: 8 } }] as never
    );
    vi.mocked(prisma.organization.groupBy).mockResolvedValueOnce(
      [{ status: "active", _count: { id: 6 } }] as never
    );
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(3);

    const res = await request(app()).get("/stats");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalOrgs: 10,
      totalUsers: 25,
      newOrgsWeek: 2,
      newUsersWeek: 3,
    });
    expect(Array.isArray(res.body.orgsByPlan)).toBe(true);
    expect(Array.isArray(res.body.orgsByStatus)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /alerts
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /alerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns alerts data", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([
      { id: "org1", name: "ACME", slug: "acme", plan: "starter", trialEnds: new Date().toISOString(), _count: { members: 1 } },
    ] as never);
    vi.mocked(prisma.moduleSubmission.count).mockResolvedValueOnce(3);
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(2);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(5);
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([
      { id: "org2", name: "Bad Corp", plan: "growth", updatedAt: new Date().toISOString() },
    ] as never);

    const res = await request(app()).get("/alerts");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      pendingSubmissions: 3,
      newOrgsWeek: 2,
      newUsersWeek: 5,
    });
    expect(Array.isArray(res.body.trialsExpiring)).toBe(true);
    expect(Array.isArray(res.body.recentCancellations)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /organizations
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /organizations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated organizations", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([ORG] as never);
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(1);

    const res = await request(app()).get("/organizations");
    expect(res.status).toBe(200);
    expect(res.body.organizations).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(typeof res.body.pages).toBe("number");
  });

  it("respects page and limit query params", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(0);

    const res = await request(app()).get("/organizations?page=2&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.limit).toBe(10);
  });

  it("supports status filter", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(0);

    const res = await request(app()).get("/organizations?status=trial");
    expect(res.status).toBe(200);
    // Verify prisma was called (filter was applied)
    expect(vi.mocked(prisma.organization.findMany)).toHaveBeenCalledOnce();
  });

  it("supports search query", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.organization.count).mockResolvedValueOnce(0);

    const res = await request(app()).get("/organizations?search=acme");
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.organization.findMany)).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /organizations/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /organizations/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns full org detail", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(ORG as never);

    const res = await request(app()).get("/organizations/org1");
    expect(res.status).toBe(200);
    expect(res.body.organization.id).toBe("org1");
  });

  it("returns 404 for unknown id", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).get("/organizations/nonexistent");
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /organizations/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /organizations/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates plan", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({ ...ORG, plan: "growth" } as never);

    const res = await request(app()).patch("/organizations/org1").send({ plan: "growth" });
    expect(res.status).toBe(200);
    expect(res.body.organization.plan).toBe("growth");
  });

  it("updates status", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({ ...ORG, status: "suspended" } as never);

    const res = await request(app()).patch("/organizations/org1").send({ status: "suspended" });
    expect(res.status).toBe(200);
    expect(res.body.organization.status).toBe("suspended");
  });

  it("updates trialEnds date", async () => {
    const newDate = new Date("2026-12-31").toISOString();
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({ ...ORG, trialEnds: newDate } as never);

    const res = await request(app()).patch("/organizations/org1").send({ trialEnds: newDate });
    expect(res.status).toBe(200);
  });

  it("rejects invalid plan", async () => {
    const res = await request(app()).patch("/organizations/org1").send({ plan: "invalid_plan" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid status", async () => {
    const res = await request(app()).patch("/organizations/org1").send({ status: "unknown" });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /organizations/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /organizations/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status to cancelled", async () => {
    vi.mocked(prisma.organization.update).mockResolvedValueOnce({ ...ORG, status: "cancelled" } as never);

    const res = await request(app()).delete("/organizations/org1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(prisma.organization.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled" } })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /users
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /users", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated users", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([USER] as never);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(1);

    const res = await request(app()).get("/users");
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.users[0].email).toBe("alice@test.com");
  });

  it("supports search", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);

    const res = await request(app()).get("/users?search=alice");
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.findMany)).toHaveBeenCalledOnce();
  });

  it("respects page limit capped at 100", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0);

    const res = await request(app()).get("/users?limit=9999");
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /users/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /users/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("promotes user to admin", async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...USER, isAdmin: true } as never);

    const res = await request(app()).patch("/users/u1").send({ isAdmin: true });
    expect(res.status).toBe(200);
    expect(res.body.user.isAdmin).toBe(true);
  });

  it("demotes admin to regular user", async () => {
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ ...USER, isAdmin: false } as never);

    const res = await request(app()).patch("/users/u1").send({ isAdmin: false });
    expect(res.status).toBe(200);
    expect(res.body.user.isAdmin).toBe(false);
  });

  it("rejects non-boolean isAdmin", async () => {
    const res = await request(app()).patch("/users/u1").send({ isAdmin: "yes" });
    expect(res.status).toBe(400);
  });

  it("rejects missing isAdmin field", async () => {
    const res = await request(app()).patch("/users/u1").send({});
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /plans
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset plan prices to code defaults so tests are not affected by persisted settings file
    platformSettings.planPrices = { starter: 29, growth: 79, pro: 149, enterprise: 299 };
  });

  it("returns plan distribution with MRR", async () => {
    vi.mocked(prisma.organization.groupBy).mockResolvedValueOnce(
      [{ plan: "starter", _count: { id: 5 } }, { plan: "pro", _count: { id: 2 } }] as never
    );
    vi.mocked(prisma.organization.groupBy).mockResolvedValueOnce(
      [{ plan: "starter", _count: { id: 3 } }] as never
    );

    const res = await request(app()).get("/plans");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(typeof res.body.totalMrr).toBe("number");
    expect(res.body.totalMrr).toBeGreaterThan(0);

    const starter = res.body.plans.find((p: { plan: string }) => p.plan === "starter");
    expect(starter).toBeDefined();
    expect(starter.count).toBe(5);
    expect(starter.mrr).toBe(5 * 29); // uses platformSettings.planPrices.starter = 29
  });

  it("returns totalMrr of 0 when no orgs", async () => {
    vi.mocked(prisma.organization.groupBy).mockResolvedValue([] as never);

    const res = await request(app()).get("/plans");
    expect(res.status).toBe(200);
    expect(res.body.totalMrr).toBe(0);
    expect(res.body.plans).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /submissions
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /submissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all submissions", async () => {
    vi.mocked(prisma.moduleSubmission.findMany).mockResolvedValueOnce([SUBMISSION] as never);
    vi.mocked(prisma.moduleSubmission.count).mockResolvedValueOnce(1);

    const res = await request(app()).get("/submissions");
    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.pendingCount).toBe(1);
  });

  it("filters by status=approved", async () => {
    vi.mocked(prisma.moduleSubmission.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.moduleSubmission.count).mockResolvedValueOnce(0);

    const res = await request(app()).get("/submissions?status=approved");
    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /submissions/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /submissions/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("approves a pending submission and creates a MarketplaceModule", async () => {
    vi.mocked(prisma.moduleSubmission.findUnique).mockResolvedValueOnce({
      ...SUBMISSION, status: "pending",
      module: null,
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([] as never);

    const res = await request(app())
      .patch("/submissions/sub1")
      .send({ status: "approved", reviewNote: "Looks great!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalledOnce();
  });

  it("rejects a pending submission", async () => {
    vi.mocked(prisma.moduleSubmission.findUnique).mockResolvedValueOnce({
      ...SUBMISSION, status: "pending", module: null,
    } as never);
    vi.mocked(prisma.moduleSubmission.update).mockResolvedValueOnce(
      { ...SUBMISSION, status: "rejected" } as never
    );

    const res = await request(app())
      .patch("/submissions/sub1")
      .send({ status: "rejected", reviewNote: "Needs work." });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(prisma.moduleSubmission.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "rejected" }) })
    );
  });

  it("returns 404 when submission not found", async () => {
    vi.mocked(prisma.moduleSubmission.findUnique).mockResolvedValueOnce(null);

    const res = await request(app())
      .patch("/submissions/nonexistent")
      .send({ status: "approved" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when submission already reviewed", async () => {
    vi.mocked(prisma.moduleSubmission.findUnique).mockResolvedValueOnce({
      ...SUBMISSION, status: "approved", module: null,
    } as never);

    const res = await request(app())
      .patch("/submissions/sub1")
      .send({ status: "approved" });

    expect(res.status).toBe(400);
  });

  it("rejects invalid status value", async () => {
    const res = await request(app())
      .patch("/submissions/sub1")
      .send({ status: "maybe" });

    expect(res.status).toBe(400);
  });

  it("rejects oversized reviewNote", async () => {
    vi.mocked(prisma.moduleSubmission.findUnique).mockResolvedValueOnce({
      ...SUBMISSION, status: "pending", module: null,
    } as never);

    const res = await request(app())
      .patch("/submissions/sub1")
      .send({ status: "rejected", reviewNote: "x".repeat(1001) });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /organizations/:id/impersonate
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /organizations/:id/impersonate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("issues impersonation token and saves admin cookie", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      ...ORG,
      members: [{ id: "m1", userId: "u1", role: "owner" }],
    } as never);

    // Send a fake admin_session cookie so the route can save it
    const res = await request(app())
      .post("/organizations/org1/impersonate")
      .set("Cookie", "access_token=fake-admin-jwt");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orgName).toBe("ACME");
    expect(res.body.orgSlug).toBe("acme");
    // Two cookies should be set: admin_session + access_token
    const cookies = res.headers["set-cookie"] as string[];
    expect(cookies.some((c: string) => c.startsWith("access_token="))).toBe(true);
    expect(cookies.some((c: string) => c.startsWith("admin_session="))).toBe(true);
  });

  it("returns 404 when org not found", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).post("/organizations/nonexistent/impersonate");
    expect(res.status).toBe(404);
  });

  it("returns 400 when org has no owner", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      ...ORG, members: [],
    } as never);

    const res = await request(app()).post("/organizations/org1/impersonate");
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /organizations/:id/backup
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /organizations/:id/backup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns org backup JSON omitting dbUrl", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      ...ORG, dbUrl: "postgresql://secret",
      members: [],
      modules:  [],
    } as never);

    const res = await request(app()).get("/organizations/org1/backup");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("1.0");
    expect(res.body.organization).toBeDefined();
    expect(res.body.organization.dbUrl).toBeUndefined();
    expect(res.body.exportedAt).toBeDefined();
  });

  it("returns 404 for unknown org", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).get("/organizations/nonexistent/backup");
    expect(res.status).toBe(404);
  });

  it("includes tenant DB tables when dbUrl is set", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({
      ...ORG, dbUrl: "postgresql://localhost/tenant",
      members: [], modules: [],
    } as never);

    const res = await request(app()).get("/organizations/org1/backup");
    expect(res.status).toBe(200);
    expect(res.body.tenantDatabase).toBeDefined();
    // getTenantClient mock returns a table "leads" with one row
    expect(res.body.tenantDatabase.leads).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /backup (bulk)
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /backup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns bulk export of all organizations without dbUrl", async () => {
    vi.mocked(prisma.organization.findMany).mockResolvedValueOnce([
      { ...ORG, dbUrl: "postgresql://secret", members: [], modules: [], _count: { members: 1, modules: 0 } },
    ] as never);

    const res = await request(app()).get("/backup");
    expect(res.status).toBe(200);
    expect(res.body.version).toBe("1.0");
    expect(res.body.totalOrganizations).toBe(1);
    expect(res.body.organizations[0].dbUrl).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /marketplace
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /marketplace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns list of marketplace modules", async () => {
    vi.mocked(prisma.marketplaceModule.findMany).mockResolvedValueOnce(
      [MARKETPLACE_MODULE] as never
    );

    const res = await request(app()).get("/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(1);
    expect(res.body.modules[0].key).toBe("my-module");
    expect(res.body.modules[0].author).toBe("Bob");
  });

  it("returns empty array when no modules", async () => {
    vi.mocked(prisma.marketplaceModule.findMany).mockResolvedValueOnce([] as never);

    const res = await request(app()).get("/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /marketplace/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /marketplace/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deactivates a module", async () => {
    vi.mocked(prisma.marketplaceModule.update).mockResolvedValueOnce(
      { ...MARKETPLACE_MODULE, isActive: false } as never
    );

    const res = await request(app()).patch("/marketplace/mm1").send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.module.isActive).toBe(false);
  });

  it("activates a module", async () => {
    vi.mocked(prisma.marketplaceModule.update).mockResolvedValueOnce(
      { ...MARKETPLACE_MODULE, isActive: true } as never
    );

    const res = await request(app()).patch("/marketplace/mm1").send({ isActive: true });
    expect(res.status).toBe(200);
    expect(res.body.module.isActive).toBe(true);
  });

  it("updates price and billing", async () => {
    vi.mocked(prisma.marketplaceModule.update).mockResolvedValueOnce(
      { ...MARKETPLACE_MODULE, price: 49, billing: "monthly" } as never
    );

    const res = await request(app()).patch("/marketplace/mm1").send({ price: 49, billing: "monthly" });
    expect(res.status).toBe(200);
    expect(res.body.module.price).toBe(49);
    expect(res.body.module.billing).toBe("monthly");
  });

  it("rejects negative price", async () => {
    const res = await request(app()).patch("/marketplace/mm1").send({ price: -5 });
    expect(res.status).toBe(400);
  });

  it("rejects invalid billing value", async () => {
    const res = await request(app()).patch("/marketplace/mm1").send({ billing: "weekly" });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /marketplace/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /marketplace/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("removes a marketplace module", async () => {
    vi.mocked(prisma.marketplaceModule.delete).mockResolvedValueOnce(MARKETPLACE_MODULE as never);

    const res = await request(app()).delete("/marketplace/mm1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(vi.mocked(prisma.marketplaceModule.delete)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mm1" } })
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /settings
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset platform settings to defaults
    platformSettings.planPrices     = { starter: 29, growth: 79, pro: 149, enterprise: 299 };
    platformSettings.trialDays      = 14;
    platformSettings.maintenanceMode = false;
    platformSettings.announcement    = "";
  });

  it("returns current platform settings", async () => {
    const res = await request(app()).get("/settings");
    expect(res.status).toBe(200);
    expect(res.body.settings).toMatchObject({
      planPrices: { starter: 29, growth: 79, pro: 149, enterprise: 299 },
      trialDays: 14,
      maintenanceMode: false,
      announcement: "",
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /settings
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformSettings.planPrices     = { starter: 29, growth: 79, pro: 149, enterprise: 299 };
    platformSettings.trialDays      = 14;
    platformSettings.maintenanceMode = false;
    platformSettings.announcement    = "";
  });

  it("updates plan prices", async () => {
    const newPrices = { starter: 19, growth: 59, pro: 99, enterprise: 199 };
    const res = await request(app()).patch("/settings").send({ planPrices: newPrices });
    expect(res.status).toBe(200);
    expect(res.body.settings.planPrices).toEqual(newPrices);
    expect(platformSettings.planPrices).toEqual(newPrices);
  });

  it("updates trialDays", async () => {
    const res = await request(app()).patch("/settings").send({ trialDays: 30 });
    expect(res.status).toBe(200);
    expect(res.body.settings.trialDays).toBe(30);
    expect(platformSettings.trialDays).toBe(30);
  });

  it("enables maintenance mode", async () => {
    const res = await request(app()).patch("/settings").send({ maintenanceMode: true });
    expect(res.status).toBe(200);
    expect(res.body.settings.maintenanceMode).toBe(true);
    expect(platformSettings.maintenanceMode).toBe(true);
  });

  it("sets announcement banner", async () => {
    const res = await request(app()).patch("/settings").send({ announcement: "Scheduled maintenance tonight" });
    expect(res.status).toBe(200);
    expect(res.body.settings.announcement).toBe("Scheduled maintenance tonight");
  });

  it("can update multiple fields at once", async () => {
    const res = await request(app()).patch("/settings").send({
      trialDays: 7,
      maintenanceMode: true,
      announcement: "We are down",
    });
    expect(res.status).toBe(200);
    expect(res.body.settings.trialDays).toBe(7);
    expect(res.body.settings.maintenanceMode).toBe(true);
    expect(res.body.settings.announcement).toBe("We are down");
  });

  it("rejects trialDays below 1", async () => {
    const res = await request(app()).patch("/settings").send({ trialDays: 0 });
    expect(res.status).toBe(400);
  });

  it("rejects trialDays above 365", async () => {
    const res = await request(app()).patch("/settings").send({ trialDays: 366 });
    expect(res.status).toBe(400);
  });

  it("rejects announcement over 500 chars", async () => {
    const res = await request(app()).patch("/settings").send({ announcement: "x".repeat(501) });
    expect(res.status).toBe(400);
  });

  it("rejects negative plan price", async () => {
    const res = await request(app()).patch("/settings").send({
      planPrices: { starter: -1, growth: 79, pro: 149, enterprise: 299 },
    });
    expect(res.status).toBe(400);
  });

  it("GET /plans uses updated prices after PATCH /settings", async () => {
    // Update prices via settings
    await request(app()).patch("/settings").send({
      planPrices: { starter: 99, growth: 79, pro: 149, enterprise: 299 },
    });

    // Now GET /plans should use the new starter price
    vi.mocked(prisma.organization.groupBy)
      .mockResolvedValueOnce([{ plan: "starter", _count: { id: 2 } }] as never)
      .mockResolvedValueOnce([] as never);

    const res = await request(app()).get("/plans");
    expect(res.status).toBe(200);
    const starter = res.body.plans.find((p: { plan: string }) => p.plan === "starter");
    expect(starter.mrr).toBe(2 * 99); // updated price applied
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /plans/config
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /plans/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformSettings.planConfigs = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIGS));
  });

  it("returns all 4 default plan configs", async () => {
    const res = await request(app()).get("/plans/config");
    expect(res.status).toBe(200);
    expect(res.body.planConfigs).toHaveLength(4);
    expect(res.body.planConfigs[0].key).toBe("starter");
    expect(res.body.planConfigs[3].key).toBe("enterprise");
  });

  it("returns correct structure for starter plan", async () => {
    const res = await request(app()).get("/plans/config");
    const starter = res.body.planConfigs[0];
    expect(starter).toMatchObject({
      key:         "starter",
      name:        "Starter",
      price:       29,
      yearlyPrice: 23,
      memberLimit: 3,
      isPopular:   false,
      ctaText:     "Get Started",
      description: expect.any(String),
    });
    expect(Array.isArray(starter.features)).toBe(true);
    expect(starter.features.length).toBeGreaterThan(0);
    expect(typeof starter.features[0].text).toBe("string");
    expect(typeof starter.features[0].included).toBe("boolean");
  });

  it("growth plan has isPopular = true by default", async () => {
    const res = await request(app()).get("/plans/config");
    const growth = res.body.planConfigs.find((p: { key: string }) => p.key === "growth");
    expect(growth.isPopular).toBe(true);
  });

  it("enterprise plan has memberLimit = 0 (unlimited)", async () => {
    const res = await request(app()).get("/plans/config");
    const enterprise = res.body.planConfigs.find((p: { key: string }) => p.key === "enterprise");
    expect(enterprise.memberLimit).toBe(0);
    expect(enterprise.ctaText).toBe("Contact Sales");
  });

  it("reflects in-memory mutations immediately", async () => {
    platformSettings.planConfigs[0]!.name = "Mini";
    const res = await request(app()).get("/plans/config");
    expect(res.body.planConfigs[0].name).toBe("Mini");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /plans/config
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /plans/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformSettings.planConfigs = JSON.parse(JSON.stringify(DEFAULT_PLAN_CONFIGS));
    platformSettings.planPrices  = { starter: 29, growth: 79, pro: 149, enterprise: 299 };
  });

  const VALID_CONFIGS = [
    {
      key: "starter", name: "Lite", description: "For small teams.", price: 19, yearlyPrice: 15,
      memberLimit: 3, isPopular: false, ctaText: "Try it",
      features: [{ text: "CRM module", included: true }],
    },
    {
      key: "growth", name: "Growth", description: "Growing businesses.", price: 79, yearlyPrice: 63,
      memberLimit: 15, isPopular: true, ctaText: "Get Started",
      features: [{ text: "CRM module", included: true }],
    },
    {
      key: "pro", name: "Pro", description: "All core modules.", price: 149, yearlyPrice: 119,
      memberLimit: 50, isPopular: false, ctaText: "Get Started",
      features: [{ text: "Everything", included: true }],
    },
    {
      key: "enterprise", name: "Enterprise", description: "Large orgs.", price: 299, yearlyPrice: 239,
      memberLimit: 0, isPopular: false, ctaText: "Contact Sales",
      features: [{ text: "All Pro features", included: true }],
    },
  ];

  it("updates planConfigs and returns the new list", async () => {
    const res = await request(app()).patch("/plans/config").send({ planConfigs: VALID_CONFIGS });
    expect(res.status).toBe(200);
    expect(res.body.planConfigs[0].name).toBe("Lite");
    expect(res.body.planConfigs[0].price).toBe(19);
    expect(platformSettings.planConfigs[0]!.name).toBe("Lite");
  });

  it("syncs planPrices when prices change", async () => {
    await request(app()).patch("/plans/config").send({ planConfigs: VALID_CONFIGS });
    expect(platformSettings.planPrices["starter"]).toBe(19);
    expect(platformSettings.planPrices["growth"]).toBe(79);
    expect(platformSettings.planPrices["pro"]).toBe(149);
    expect(platformSettings.planPrices["enterprise"]).toBe(299);
  });

  it("new prices propagate to GET /plans MRR calculations", async () => {
    await request(app()).patch("/plans/config").send({ planConfigs: VALID_CONFIGS });

    vi.mocked(prisma.organization.groupBy)
      .mockResolvedValueOnce([{ plan: "starter", _count: { id: 3 } }] as never)
      .mockResolvedValueOnce([] as never);

    const res = await request(app()).get("/plans");
    expect(res.status).toBe(200);
    const starter = res.body.plans.find((p: { plan: string }) => p.plan === "starter");
    expect(starter.mrr).toBe(3 * 19); // updated price applied
  });

  it("partial update (single plan array) is accepted", async () => {
    const single = [{
      key: "starter", name: "Solo", description: "Just one user.", price: 9, yearlyPrice: 7,
      memberLimit: 1, isPopular: false, ctaText: "Start", features: [{ text: "CRM", included: true }],
    }];
    const res = await request(app()).patch("/plans/config").send({ planConfigs: single });
    expect(res.status).toBe(200);
    expect(res.body.planConfigs).toHaveLength(1);
    expect(platformSettings.planPrices["starter"]).toBe(9);
  });

  it("rejects empty planConfigs array", async () => {
    const res = await request(app()).patch("/plans/config").send({ planConfigs: [] });
    expect(res.status).toBe(400);
  });

  it("rejects missing planConfigs field", async () => {
    const res = await request(app()).patch("/plans/config").send({});
    expect(res.status).toBe(400);
  });

  it("rejects plan with empty name", async () => {
    const bad = VALID_CONFIGS.map((p, i) => (i === 0 ? { ...p, name: "" } : p));
    const res = await request(app()).patch("/plans/config").send({ planConfigs: bad });
    expect(res.status).toBe(400);
  });

  it("rejects plan with negative price", async () => {
    const bad = VALID_CONFIGS.map((p, i) => (i === 0 ? { ...p, price: -5 } : p));
    const res = await request(app()).patch("/plans/config").send({ planConfigs: bad });
    expect(res.status).toBe(400);
  });

  it("rejects empty features array on a plan", async () => {
    const bad = VALID_CONFIGS.map((p, i) => (i === 0 ? { ...p, features: [] } : p));
    const res = await request(app()).patch("/plans/config").send({ planConfigs: bad });
    expect(res.status).toBe(400);
  });

  it("rejects feature with empty text", async () => {
    const bad = VALID_CONFIGS.map((p, i) =>
      i === 0 ? { ...p, features: [{ text: "", included: true }] } : p
    );
    const res = await request(app()).patch("/plans/config").send({ planConfigs: bad });
    expect(res.status).toBe(400);
  });

  it("rejects negative yearlyPrice", async () => {
    const bad = VALID_CONFIGS.map((p, i) => (i === 0 ? { ...p, yearlyPrice: -1 } : p));
    const res = await request(app()).patch("/plans/config").send({ planConfigs: bad });
    expect(res.status).toBe(400);
  });

  it("rejects plan name over 40 chars", async () => {
    const bad = VALID_CONFIGS.map((p, i) => (i === 0 ? { ...p, name: "x".repeat(41) } : p));
    const res = await request(app()).patch("/plans/config").send({ planConfigs: bad });
    expect(res.status).toBe(400);
  });
});
