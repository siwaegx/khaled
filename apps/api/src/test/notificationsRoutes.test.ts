import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { userId: "u1", orgId: "org1", role: "owner", isAdmin: false };
    next();
  },
}));

const mockNotification = vi.fn();
const mockDb = {
  notification: {
    findMany:    vi.fn(),
    updateMany:  vi.fn(),
    deleteMany:  vi.fn(),
  },
};

vi.mock("../lib/prisma", () => ({
  prisma: new Proxy({}, {
    get: (_t, p) => p === "notification" ? mockDb.notification : undefined,
  }),
}));

import { notificationsRouter } from "../routes/notifications";

function app() { return makeApp(notificationsRouter); }

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns notifications and unreadCount", async () => {
    const items = [
      { id: "n1", title: "Test", readAt: null, createdAt: new Date().toISOString() },
      { id: "n2", title: "Read", readAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    ];
    mockDb.notification.findMany.mockResolvedValue(items);

    const res = await request(app()).get("/");
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.unreadCount).toBe(1);
  });

  it("respects limit param", async () => {
    mockDb.notification.findMany.mockResolvedValue([]);
    await request(app()).get("/?limit=5");
    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  it("caps limit at 100", async () => {
    mockDb.notification.findMany.mockResolvedValue([]);
    await request(app()).get("/?limit=999");
    expect(mockDb.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });
});

describe("PATCH /api/notifications/read-all", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks all as read", async () => {
    mockDb.notification.updateMany.mockResolvedValue({ count: 2 });
    const res = await request(app()).patch("/read-all");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDb.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", readAt: null } })
    );
  });
});

describe("PATCH /api/notifications/read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks specific ids as read", async () => {
    mockDb.notification.updateMany.mockResolvedValue({ count: 1 });
    const res = await request(app()).patch("/read").send({ ids: ["n1"] });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDb.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["n1"] } }) })
    );
  });

  it("returns 400 for empty ids", async () => {
    const res = await request(app()).patch("/read").send({ ids: [] });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing ids", async () => {
    const res = await request(app()).patch("/read").send({});
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/notifications/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes notification", async () => {
    mockDb.notification.deleteMany.mockResolvedValue({ count: 1 });
    const res = await request(app()).delete("/n1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDb.notification.deleteMany).toHaveBeenCalledWith(
      { where: { id: "n1", userId: "u1" } }
    );
  });
});

void mockNotification; // suppress unused warning
