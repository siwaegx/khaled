import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../middleware/errorHandler";
import { documentsRouter } from "../routes/documents";

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { userId: "u1", orgId: "org1", role: "manager", isAdmin: false };
    next();
  },
}));

vi.mock("../middleware/tenantResolver", () => ({
  resolveTenant: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("fs/promises", async () => {
  return {
    default: { mkdir: vi.fn().mockResolvedValue(undefined), unlink: vi.fn().mockResolvedValue(undefined) },
    mkdir: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("fs", () => ({
  default: {
    createWriteStream: vi.fn(() => ({
      on: vi.fn(), write: vi.fn(), end: vi.fn(),
      once: vi.fn(), emit: vi.fn(), writable: true,
    })),
  },
  createWriteStream: vi.fn(() => ({
    on: vi.fn(), write: vi.fn(), end: vi.fn(),
    once: vi.fn(), emit: vi.fn(), writable: true,
  })),
}));

vi.mock("stream/promises", () => ({
  default: { pipeline: vi.fn().mockResolvedValue(undefined) },
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

const mockDocument = {
  findMany:   vi.fn(),
  findUnique: vi.fn(),
  create:     vi.fn(),
  delete:     vi.fn(),
};

function makeDocApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user    = { userId: "u1", orgId: "org1", role: "manager", isAdmin: false };
    req.tenantDb = { document: mockDocument } as unknown as never;
    next();
  });
  app.use("/", documentsRouter);
  app.use(errorHandler);
  return app;
}

const sampleDoc = {
  id: "doc1",
  entityType: "lead",
  entityId: "lead1",
  name: "file.pdf",
  originalName: "file.pdf",
  mimeType: "application/pdf",
  size: 12345,
  storagePath: "12345_abc_file.pdf",
  uploadedBy: "u1",
  createdAt: new Date().toISOString(),
};

describe("GET /api/documents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns documents for entity", async () => {
    mockDocument.findMany.mockResolvedValue([sampleDoc]);
    const res = await request(makeDocApp()).get("/?entityType=lead&entityId=lead1");
    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
    expect(res.body.documents[0].name).toBe("file.pdf");
  });

  it("returns 400 when entityType missing", async () => {
    const res = await request(makeDocApp()).get("/?entityId=lead1");
    expect(res.status).toBe(400);
  });

  it("returns 400 when entityId missing", async () => {
    const res = await request(makeDocApp()).get("/?entityType=lead");
    expect(res.status).toBe(400);
  });

  it("returns empty array when no documents", async () => {
    mockDocument.findMany.mockResolvedValue([]);
    const res = await request(makeDocApp()).get("/?entityType=lead&entityId=lead1");
    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(0);
  });
});

describe("DELETE /api/documents/:id", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes document", async () => {
    mockDocument.findUnique.mockResolvedValue(sampleDoc);
    mockDocument.delete.mockResolvedValue(sampleDoc);
    const res = await request(makeDocApp()).delete("/doc1");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockDocument.delete).toHaveBeenCalledWith({ where: { id: "doc1" } });
  });

  it("returns 404 for non-existent document", async () => {
    mockDocument.findUnique.mockResolvedValue(null);
    const res = await request(makeDocApp()).delete("/nope");
    expect(res.status).toBe(404);
  });
});
