import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../middleware/errorHandler";

vi.mock("@business360/module-sdk", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.name = "AppError";
    }
  },
  requireRole: (minRole: string) => (req: { user?: { role: string } }, _res: unknown, next: (e?: Error) => void) => {
    const rank: Record<string, number> = { member: 0, manager: 1, owner: 2 };
    if ((rank[req.user?.role ?? "member"] ?? 0) < (rank[minRole] ?? 0)) {
      return next(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
    }
    next();
  },
  logActivity: vi.fn().mockResolvedValue(undefined),
  fireHook:    vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { userId: "u1", orgId: "org1", role: "manager", isAdmin: false };
    next();
  },
}));

import { router } from "../../../../modules/calendar/backend/router";

const mockCalendarEvent = {
  findMany:   vi.fn(),
  findUnique: vi.fn(),
  create:     vi.fn(),
  update:     vi.fn(),
  delete:     vi.fn(),
};

function makeCalApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user      = { userId: "u1", orgId: "org1", role: "manager", isAdmin: false };
    req.tenantDb  = { calendarEvent: mockCalendarEvent } as unknown as never;
    req.hookService = { fire: vi.fn().mockResolvedValue(undefined) };
    next();
  });
  app.use("/", router);
  app.use(errorHandler);
  return app;
}

const sampleEvent = {
  id:        "ev1",
  title:     "Team Meeting",
  startAt:   new Date("2026-05-15T09:00:00Z"),
  endAt:     new Date("2026-05-15T10:00:00Z"),
  allDay:    false,
  type:      "meeting",
  createdBy: "u1",
};

describe("GET /calendar/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns event list", async () => {
    mockCalendarEvent.findMany.mockResolvedValue([sampleEvent]);
    const res = await request(makeCalApp()).get("/events");
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].title).toBe("Team Meeting");
  });

  it("filters by date range", async () => {
    mockCalendarEvent.findMany.mockResolvedValue([]);
    await request(makeCalApp()).get("/events?from=2026-05-01T00:00:00Z&to=2026-05-31T23:59:59Z");
    expect(mockCalendarEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { startAt: { gte: new Date("2026-05-01T00:00:00Z"), lte: new Date("2026-05-31T23:59:59Z") } },
      })
    );
  });

  it("returns 400 for invalid date", async () => {
    const res = await request(makeCalApp()).get("/events?from=not-a-date");
    expect(res.status).toBe(400);
  });
});

describe("POST /calendar/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an event", async () => {
    mockCalendarEvent.create.mockResolvedValue(sampleEvent);
    const res = await request(makeCalApp()).post("/events").send({
      title:   "Team Meeting",
      startAt: "2026-05-15T09:00:00Z",
      endAt:   "2026-05-15T10:00:00Z",
      type:    "meeting",
    });
    expect(res.status).toBe(201);
    expect(res.body.event.title).toBe("Team Meeting");
  });

  it("returns 400 for missing title", async () => {
    const res = await request(makeCalApp()).post("/events").send({
      startAt: "2026-05-15T09:00:00Z",
      endAt:   "2026-05-15T10:00:00Z",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when start > end", async () => {
    const res = await request(makeCalApp()).post("/events").send({
      title:   "Bad",
      startAt: "2026-05-15T11:00:00Z",
      endAt:   "2026-05-15T09:00:00Z",
      type:    "meeting",
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /calendar/events/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates an event", async () => {
    mockCalendarEvent.findUnique.mockResolvedValue(sampleEvent);
    mockCalendarEvent.update.mockResolvedValue({ ...sampleEvent, title: "Updated" });
    const res = await request(makeCalApp()).patch("/events/ev1").send({ title: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.event.title).toBe("Updated");
  });

  it("returns 404 for non-existent event", async () => {
    mockCalendarEvent.findUnique.mockResolvedValue(null);
    const res = await request(makeCalApp()).patch("/events/nope").send({ title: "X" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /calendar/events/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an event", async () => {
    mockCalendarEvent.findUnique.mockResolvedValue(sampleEvent);
    mockCalendarEvent.delete.mockResolvedValue(sampleEvent);
    const res = await request(makeCalApp()).delete("/events/ev1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("returns 404 if not found", async () => {
    mockCalendarEvent.findUnique.mockResolvedValue(null);
    const res = await request(makeCalApp()).delete("/events/nope");
    expect(res.status).toBe(404);
  });
});
