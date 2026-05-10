import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";

// ── Mock requireAuth ──────────────────────────────────────────────────────────
vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (
    req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } },
    _res: unknown,
    next: () => void,
  ) => {
    req.user = { userId: "u1", orgId: "org1", role: "owner", isAdmin: false };
    next();
  },
}));

// ── Mock engine (getAllManifests replaces static MODULE_REGISTRY) ─────────────
vi.mock("@business360/engine", () => ({
  getAllManifests: vi.fn(() => [
    {
      key: "crm", name: "CRM", category: "core", requiredPlan: "starter",
      description: "Manage leads, deals, and customers.",
      isComingSoon: false, rating: 4.8, version: "1.0.0",
    },
    {
      key: "inventory", name: "Inventory", category: "core", requiredPlan: "growth",
      description: "Track products and warehouses.",
      isComingSoon: false, rating: 4.5, version: "1.0.0",
    },
    {
      key: "coming-soon", name: "AI Module", category: "premium", requiredPlan: "enterprise",
      description: "Coming soon.",
      isComingSoon: true, rating: 0, version: "0.1.0",
    },
  ]),
  getManifest:    vi.fn(),
  clearRegistry:  vi.fn(),
  register:       vi.fn(),
  planIncludes:   vi.fn(() => true),
}));

// ── Mock prisma ───────────────────────────────────────────────────────────────
vi.mock("../lib/prisma", () => ({
  prisma: {
    installedModule: {
      findMany:   vi.fn(),
      findUnique: vi.fn(),
    },
    organization: {
      findUnique: vi.fn(),
    },
    marketplaceModule: {
      findMany: vi.fn(),
    },
  },
}));

import { storeRouter } from "../routes/store";
import { prisma } from "../lib/prisma";

function app() {
  return makeApp(storeRouter);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MARKETPLACE_MODULE = {
  id: "mm1", key: "my-module", name: "My Module", version: "1.0.0",
  category: "community", description: "Great third-party module.",
  author: "Bob", repoUrl: "https://github.com/bob/my-module",
  price: 0, billing: "free", rating: 4.2, installCount: 42,
  publishedAt: new Date().toISOString(), isActive: true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// GET /catalog
// ═══════════════════════════════════════════════════════════════════════════════

describe("Store — GET /catalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns full catalog with install state and plan availability", async () => {
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce([
      { moduleKey: "crm" },
    ] as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(
      { plan: "growth" } as never
    );

    const res = await request(app()).get("/catalog");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.catalog)).toBe(true);
    expect(res.body.catalog).toHaveLength(3);

    const crm = res.body.catalog.find((m: { key: string }) => m.key === "crm");
    expect(crm.installed).toBe(true);
    expect(crm.available).toBe(true);

    const inventory = res.body.catalog.find((m: { key: string }) => m.key === "inventory");
    expect(inventory.installed).toBe(false);
    expect(inventory.available).toBe(true); // growth plan can access growth modules
  });

  it("marks modules unavailable when plan is too low", async () => {
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(
      { plan: "starter" } as never
    );

    const res = await request(app()).get("/catalog");
    expect(res.status).toBe(200);

    const inventory = res.body.catalog.find((m: { key: string }) => m.key === "inventory");
    expect(inventory.available).toBe(false); // starter can't access growth modules
  });

  it("returns stats summary", async () => {
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ plan: "starter" } as never);

    const res = await request(app()).get("/catalog");
    expect(res.status).toBe(200);
    expect(typeof res.body.stats.total).toBe("number");
    expect(typeof res.body.stats.installed).toBe("number");
    expect(typeof res.body.stats.available).toBe("number");
  });

  it("returns 200 with empty install state when org has no modules", async () => {
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce(
      { plan: "starter" } as never
    );

    const res = await request(app()).get("/catalog");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.catalog)).toBe(true);
    expect(res.body.stats.installed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /catalog/:key
// ═══════════════════════════════════════════════════════════════════════════════

describe("Store — GET /catalog/:key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns module detail with install state", async () => {
    vi.mocked(prisma.installedModule.findUnique).mockResolvedValueOnce(
      { isActive: true } as never
    );
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ plan: "starter" } as never);

    const res = await request(app()).get("/catalog/crm");
    expect(res.status).toBe(200);
    expect(res.body.module.key).toBe("crm");
    expect(res.body.module.installed).toBe(true);
    expect(res.body.module.available).toBe(true);
  });

  it("returns installed=false when not installed", async () => {
    vi.mocked(prisma.installedModule.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ plan: "starter" } as never);

    const res = await request(app()).get("/catalog/crm");
    expect(res.status).toBe(200);
    expect(res.body.module.installed).toBe(false);
  });

  it("returns 404 for unknown module key", async () => {
    const res = await request(app()).get("/catalog/nonexistent-module");
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /submit (legacy redirect)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Store — POST /submit", () => {
  it("returns 301 redirect to developer portal", async () => {
    const res = await request(app()).post("/submit").send({ name: "Test" });
    expect(res.status).toBe(301);
    expect(res.body.redirectTo).toBe("/dashboard/store/developer");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /marketplace
// ═══════════════════════════════════════════════════════════════════════════════

describe("Store — GET /marketplace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active marketplace modules with install state", async () => {
    vi.mocked(prisma.marketplaceModule.findMany).mockResolvedValueOnce(
      [MARKETPLACE_MODULE] as never
    );
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce([] as never);

    const res = await request(app()).get("/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(1);
    expect(res.body.modules[0].key).toBe("my-module");
    expect(res.body.modules[0].installed).toBe(false);
  });

  it("marks module as installed when org has it", async () => {
    vi.mocked(prisma.marketplaceModule.findMany).mockResolvedValueOnce(
      [MARKETPLACE_MODULE] as never
    );
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce(
      [{ moduleKey: "my-module" }] as never
    );

    const res = await request(app()).get("/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.modules[0].installed).toBe(true);
  });

  it("returns empty array when no marketplace modules", async () => {
    vi.mocked(prisma.marketplaceModule.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.installedModule.findMany).mockResolvedValueOnce([] as never);

    const res = await request(app()).get("/marketplace");
    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(0);
  });
});
