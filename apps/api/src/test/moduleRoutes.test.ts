import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeApp } from "./helpers";

vi.mock("../middleware/requireAuth", () => ({
  requireAuth: (req: { user?: { userId: string; orgId: string; role: string; isAdmin: boolean } }, _res: unknown, next: () => void) => {
    req.user = { userId: "u1", orgId: "org1", role: "owner", isAdmin: false };
    next();
  },
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    installedModule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    organization: { findUnique: vi.fn() },
  },
}));

vi.mock("@business360/engine", () => ({
  getManifest: vi.fn(),
  isAvailableForPlan: vi.fn(),
  getAllManifests: vi.fn(() => []),
}));

vi.mock("../engine/module_loader", () => ({
  getManifest: vi.fn(),
}));

vi.mock("../engine/module_installer", () => ({
  installModule: vi.fn(),
  uninstallModule: vi.fn(),
}));

import { modulesRouter } from "../routes/modules";
import { prisma } from "../lib/prisma";
import { installModule, uninstallModule } from "../engine/module_installer";
import { getAllManifests } from "@business360/engine";
import { AppError } from "../middleware/errorHandler";

function app() {
  return makeApp(modulesRouter);
}

describe("GET /api/modules", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns module list", async () => {
    vi.mocked(prisma.installedModule.findMany).mockResolvedValue([{ moduleKey: "crm" }] as never);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ plan: "starter" } as never);
    vi.mocked(getAllManifests).mockReturnValue([
      { key: "crm", name: "CRM", requiredPlan: "starter" } as never,
    ]);

    const res = await request(app()).get("/");
    expect(res.status).toBe(200);
    expect(res.body.modules).toHaveLength(1);
    expect(res.body.modules[0].key).toBe("crm");
    expect(res.body.modules[0].installed).toBe(true);
  });

  it("marks unavailable for plan", async () => {
    vi.mocked(prisma.installedModule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ plan: "starter" } as never);
    vi.mocked(getAllManifests).mockReturnValue([
      { key: "reports", name: "Reports", requiredPlan: "enterprise" } as never,
    ]);

    const res = await request(app()).get("/");
    expect(res.body.modules[0].available).toBe(false);
  });
});

describe("POST /api/modules/install", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for missing moduleKey", async () => {
    const res = await request(app()).post("/install").send({});
    expect(res.status).toBe(400);
  });

  it("calls installModule and returns 201", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ plan: "starter" } as never);
    vi.mocked(installModule).mockResolvedValue(undefined);
    vi.mocked(prisma.installedModule.findUnique).mockResolvedValue({
      moduleKey: "crm", isActive: true,
    } as never);

    const res = await request(app()).post("/install").send({ moduleKey: "crm" });
    expect(res.status).toBe(201);
    expect(installModule).toHaveBeenCalledWith("org1", "crm", "starter");
  });

  it("returns 403 when plan insufficient", async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({ plan: "starter" } as never);
    vi.mocked(installModule).mockRejectedValue(new AppError(403, "Module requires pro plan"));

    const res = await request(app()).post("/install").send({ moduleKey: "reports" });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/pro/);
  });
});

describe("DELETE /api/modules/:key", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200 on successful uninstall", async () => {
    vi.mocked(uninstallModule).mockResolvedValue(undefined);
    const res = await request(app()).delete("/crm");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(uninstallModule).toHaveBeenCalledWith("org1", "crm");
  });

  it("returns 404 if not installed", async () => {
    vi.mocked(uninstallModule).mockRejectedValue(new AppError(404, "Module not installed"));
    const res = await request(app()).delete("/ghost");
    expect(res.status).toBe(404);
  });
});
