import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── module_installer ────────────────────────────────────────────────────────

vi.mock("../lib/prisma", () => ({
  prisma: {
    installedModule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@business360/engine", () => ({
  getManifest: vi.fn(),
  isAvailableForPlan: vi.fn(),
  getAllManifests: vi.fn(() => []),
}));

import { installModule, uninstallModule } from "../engine/module_installer";
import { prisma } from "../lib/prisma";
import { getManifest, isAvailableForPlan } from "@business360/engine";

describe("installModule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 404 when manifest not found", async () => {
    vi.mocked(getManifest).mockReturnValue(undefined);
    await expect(installModule("org1", "ghost", "starter"))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 403 when plan insufficient", async () => {
    vi.mocked(getManifest).mockReturnValue({ key: "crm", requiredPlan: "pro" } as never);
    vi.mocked(isAvailableForPlan).mockReturnValue(false);
    await expect(installModule("org1", "crm", "starter"))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("upserts InstalledModule on success", async () => {
    vi.mocked(getManifest).mockReturnValue({ key: "crm", requiredPlan: "starter" } as never);
    vi.mocked(isAvailableForPlan).mockReturnValue(true);
    vi.mocked(prisma.installedModule.upsert).mockResolvedValue({} as never);

    await installModule("org1", "crm", "starter");
    expect(prisma.installedModule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_moduleKey: { organizationId: "org1", moduleKey: "crm" } },
        create: expect.objectContaining({ organizationId: "org1", moduleKey: "crm", isActive: true }),
        update: { isActive: true },
      })
    );
  });
});

describe("uninstallModule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 404 when module not installed", async () => {
    vi.mocked(prisma.installedModule.findUnique).mockResolvedValue(null);
    await expect(uninstallModule("org1", "crm"))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it("soft-deletes on success", async () => {
    vi.mocked(prisma.installedModule.findUnique).mockResolvedValue({ moduleKey: "crm", isActive: true } as never);
    vi.mocked(prisma.installedModule.findMany).mockResolvedValue([]);
    vi.mocked(prisma.installedModule.update).mockResolvedValue({} as never);

    await uninstallModule("org1", "crm");
    expect(prisma.installedModule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });
});

// ─── module_loader ─────────────────────────────────────────────────────────

import { clearManifestCache } from "../engine/module_loader";
import { loadAllManifests, getManifest as getLoaderManifest } from "../engine/module_loader";
import fs from "fs";
import path from "path";

vi.mock("fs");

describe("module_loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearManifestCache();
  });

  it("returns [] when modules dir does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(loadAllManifests()).toEqual([]);
  });

  it("loads and caches manifests from disk", () => {
    const fakePath = path.resolve(__dirname, "../modules");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "crm", isDirectory: () => true } as never,
    ]);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ key: "crm", name: "CRM", planRequired: "starter" })
    );

    const manifests = loadAllManifests();
    expect(manifests).toHaveLength(1);
    expect(manifests[0]!.key).toBe("crm");
  });

  it("skips non-directory entries", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "README.md", isDirectory: () => false } as never,
    ]);

    const manifests = loadAllManifests();
    expect(manifests).toHaveLength(0);
  });

  it("skips directories with no manifest.json", () => {
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(true)  // MODULES_DIR exists
      .mockReturnValueOnce(false); // manifest.json missing
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: "crm", isDirectory: () => true } as never,
    ]);

    const manifests = loadAllManifests();
    expect(manifests).toHaveLength(0);
  });

  it("getManifest returns undefined for unknown key", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(getLoaderManifest("ghost")).toBeUndefined();
  });
});
