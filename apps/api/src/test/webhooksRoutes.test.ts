import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { userId: "u1", orgId: "org1", role: "owner", isAdmin: false };
    next();
  },
}));

const mockOrgWebhook = {
  findMany:    vi.fn(),
  findFirst:   vi.fn(),
  create:      vi.fn(),
  update:      vi.fn(),
  updateMany:  vi.fn(),
  delete:      vi.fn(),
  deleteMany:  vi.fn(),
};

const mockWebhookDelivery = {
  findMany: vi.fn(),
};

vi.mock("../lib/prisma", () => ({
  prisma: new Proxy({}, {
    get: (_t, p) => {
      if (p === "orgWebhook")      return mockOrgWebhook;
      if (p === "webhookDelivery") return mockWebhookDelivery;
      return undefined;
    },
  }),
}));

import { webhooksRouter } from "../routes/webhooks";

function app() { return makeApp(webhooksRouter); }

const sampleWebhook = {
  id: "wh1", organizationId: "org1", url: "https://example.com/wh",
  events: ["lead.created"], isActive: true, createdAt: new Date().toISOString(),
  deliveries: [],
};

describe("GET /api/webhooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns webhooks list", async () => {
    mockOrgWebhook.findMany.mockResolvedValue([sampleWebhook]);
    const res = await request(app()).get("/");
    expect(res.status).toBe(200);
    expect(res.body.webhooks).toHaveLength(1);
    expect(res.body.webhooks[0].url).toBe("https://example.com/wh");
  });
});

describe("POST /api/webhooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a webhook", async () => {
    mockOrgWebhook.create.mockResolvedValue(sampleWebhook);
    const res = await request(app()).post("/").send({
      url: "https://example.com/wh",
      events: ["lead.created"],
    });
    expect(res.status).toBe(201);
    expect(res.body.webhook.url).toBe("https://example.com/wh");
  });

  it("returns 400 for invalid URL", async () => {
    const res = await request(app()).post("/").send({ url: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unknown event type", async () => {
    const res = await request(app()).post("/").send({
      url: "https://example.com/wh",
      events: ["fake.event"],
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/webhooks/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates a webhook", async () => {
    const updated = { ...sampleWebhook, isActive: false };
    mockOrgWebhook.updateMany.mockResolvedValue({ count: 1 });
    mockOrgWebhook.findFirst.mockResolvedValue(updated);
    const res = await request(app()).patch("/wh1").send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.webhook.isActive).toBe(false);
  });

  it("returns 404 for wrong org", async () => {
    mockOrgWebhook.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app()).patch("/wh999").send({ isActive: false });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/webhooks/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a webhook", async () => {
    mockOrgWebhook.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app()).delete("/wh1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 404 if not found", async () => {
    mockOrgWebhook.deleteMany.mockResolvedValue({ count: 0 });
    const res = await request(app()).delete("/wh999");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/webhooks/:id/deliveries", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns delivery history", async () => {
    mockOrgWebhook.findFirst.mockResolvedValue(sampleWebhook);
    mockWebhookDelivery.findMany.mockResolvedValue([
      { id: "d1", webhookId: "wh1", event: "lead.created", statusCode: 200, sentAt: new Date().toISOString() },
    ]);
    const res = await request(app()).get("/wh1/deliveries");
    expect(res.status).toBe(200);
    expect(res.body.deliveries).toHaveLength(1);
  });
});
