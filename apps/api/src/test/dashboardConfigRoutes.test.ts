import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { userId: "u1", orgId: "org1", role: "owner", isAdmin: false };
    next();
  },
}));

const mockOrg = {
  findUnique: vi.fn(),
  update:     vi.fn(),
};

vi.mock("../lib/prisma", () => ({
  prisma: new Proxy({}, {
    get: (_t, p) => p === "organization" ? mockOrg : undefined,
  }),
}));

import { dashboardConfigRouter } from "../routes/dashboardConfig";

function app() { return makeApp(dashboardConfigRouter); }

const sampleConfig = {
  widgets: [
    { key: "kpi-cards",  visible: true,  order: 0 },
    { key: "live-stats", visible: false, order: 1 },
    { key: "modules",    visible: true,  order: 2 },
  ],
};

describe("GET /api/dashboard/config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stored config", async () => {
    mockOrg.findUnique.mockResolvedValue({ dashboardConfig: sampleConfig });
    const res = await request(app()).get("/config");
    expect(res.status).toBe(200);
    expect(res.body.config.widgets).toHaveLength(3);
  });

  it("returns null config when not set", async () => {
    mockOrg.findUnique.mockResolvedValue({ dashboardConfig: null });
    const res = await request(app()).get("/config");
    expect(res.status).toBe(200);
    expect(res.body.config).toBeNull();
  });

  it("handles missing dashboardConfig gracefully", async () => {
    mockOrg.findUnique.mockResolvedValue({});
    const res = await request(app()).get("/config");
    expect(res.status).toBe(200);
    expect(res.body.config).toBeNull();
  });
});

describe("PUT /api/dashboard/config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves widget config", async () => {
    mockOrg.update.mockResolvedValue({});
    const res = await request(app()).put("/config").send(sampleConfig);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockOrg.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dashboardConfig: sampleConfig } })
    );
  });

  it("returns 400 for invalid payload", async () => {
    const res = await request(app()).put("/config").send({ widgets: "bad" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for widget with missing key", async () => {
    const res = await request(app()).put("/config").send({
      widgets: [{ visible: true, order: 0 }],
    });
    expect(res.status).toBe(400);
  });
});
