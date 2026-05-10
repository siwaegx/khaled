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

// ── Mock prisma ───────────────────────────────────────────────────────────────
vi.mock("../lib/prisma", () => ({
  prisma: {
    developerProfile: {
      findUnique: vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
    },
    moduleSubmission: {
      findFirst: vi.fn(),
      findMany:  vi.fn(),
      create:    vi.fn(),
    },
  },
}));

import { developerRouter } from "../routes/developer";
import { prisma } from "../lib/prisma";

function app() {
  return makeApp(developerRouter);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROFILE = {
  id: "dev1", userId: "u1", displayName: "Alice Dev",
  website: "https://alice.dev", bio: "I build modules.",
  createdAt: new Date().toISOString(),
  submissions: [],
};

const SUBMISSION = {
  id: "sub1", developerId: "dev1", key: "my-module", name: "My Module",
  version: "1.0.0", category: "community",
  description: "A great module that does useful things",
  repoUrl: "https://github.com/alice/my-module",
  contactEmail: "alice@dev.com",
  status: "pending", reviewNote: null,
  submittedAt: new Date().toISOString(),
  module: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// POST /profile
// ═══════════════════════════════════════════════════════════════════════════════

describe("Developer — POST /profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a new developer profile", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.developerProfile.create).mockResolvedValueOnce(PROFILE as never);

    const res = await request(app()).post("/profile")
      .send({ displayName: "Alice Dev", website: "https://alice.dev", bio: "I build modules." });
    expect(res.status).toBe(201);
    expect(res.body.profile.displayName).toBe("Alice Dev");
  });

  it("returns 409 when profile already exists", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(PROFILE as never);

    const res = await request(app()).post("/profile")
      .send({ displayName: "Alice Dev" });
    expect(res.status).toBe(409);
  });

  it("rejects displayName shorter than 2 chars", async () => {
    const res = await request(app()).post("/profile").send({ displayName: "A" });
    expect(res.status).toBe(400);
  });

  it("rejects displayName longer than 80 chars", async () => {
    const res = await request(app()).post("/profile").send({ displayName: "A".repeat(81) });
    expect(res.status).toBe(400);
  });

  it("rejects invalid website URL", async () => {
    const res = await request(app()).post("/profile")
      .send({ displayName: "Alice Dev", website: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("accepts empty string website (treated as null)", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.developerProfile.create).mockResolvedValueOnce({ ...PROFILE, website: null } as never);

    const res = await request(app()).post("/profile")
      .send({ displayName: "Alice Dev", website: "" });
    expect(res.status).toBe(201);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /profile
// ═══════════════════════════════════════════════════════════════════════════════

describe("Developer — GET /profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the developer profile with submissions", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(
      { ...PROFILE, submissions: [SUBMISSION] } as never
    );

    const res = await request(app()).get("/profile");
    expect(res.status).toBe(200);
    expect(res.body.profile.displayName).toBe("Alice Dev");
    expect(res.body.profile.submissions).toHaveLength(1);
  });

  it("returns 404 when no profile found", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).get("/profile");
    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /profile
// ═══════════════════════════════════════════════════════════════════════════════

describe("Developer — PATCH /profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates the profile bio", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(PROFILE as never);
    vi.mocked(prisma.developerProfile.update).mockResolvedValueOnce(
      { ...PROFILE, bio: "Updated bio." } as never
    );

    const res = await request(app()).patch("/profile").send({ bio: "Updated bio." });
    expect(res.status).toBe(200);
    expect(res.body.profile.bio).toBe("Updated bio.");
  });

  it("returns 404 when profile does not exist", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).patch("/profile").send({ bio: "Bio" });
    expect(res.status).toBe(404);
  });

  it("rejects bio over 500 chars", async () => {
    const res = await request(app()).patch("/profile").send({ bio: "x".repeat(501) });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /submissions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Developer — POST /submissions", () => {
  beforeEach(() => vi.clearAllMocks());

  const VALID_SUBMISSION = {
    name: "My Module",
    key: "my-module",
    version: "1.0.0",
    category: "community",
    description: "A great module that does useful things",
    repoUrl: "https://github.com/alice/my-module",
    contactEmail: "alice@dev.com",
  };

  it("submits a module for review", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(PROFILE as never);
    vi.mocked(prisma.moduleSubmission.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.moduleSubmission.create).mockResolvedValueOnce(SUBMISSION as never);

    const res = await request(app()).post("/submissions").send(VALID_SUBMISSION);
    expect(res.status).toBe(201);
    expect(res.body.submission.key).toBe("my-module");
  });

  it("returns 403 when no developer profile exists", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).post("/submissions").send(VALID_SUBMISSION);
    expect(res.status).toBe(403);
  });

  it("returns 409 when module key is already in use", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(PROFILE as never);
    vi.mocked(prisma.moduleSubmission.findFirst).mockResolvedValueOnce(SUBMISSION as never);

    const res = await request(app()).post("/submissions").send(VALID_SUBMISSION);
    expect(res.status).toBe(409);
  });

  it("rejects invalid module key (uppercase)", async () => {
    const res = await request(app()).post("/submissions")
      .send({ ...VALID_SUBMISSION, key: "My-Module" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid version format", async () => {
    const res = await request(app()).post("/submissions")
      .send({ ...VALID_SUBMISSION, version: "v1.0" });
    expect(res.status).toBe(400);
  });

  it("rejects description shorter than 10 chars", async () => {
    const res = await request(app()).post("/submissions")
      .send({ ...VALID_SUBMISSION, description: "Too short" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid repoUrl", async () => {
    const res = await request(app()).post("/submissions")
      .send({ ...VALID_SUBMISSION, repoUrl: "github.com/alice/repo" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid contactEmail", async () => {
    const res = await request(app()).post("/submissions")
      .send({ ...VALID_SUBMISSION, contactEmail: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("rejects invalid category", async () => {
    const res = await request(app()).post("/submissions")
      .send({ ...VALID_SUBMISSION, category: "experimental" });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /submissions
// ═══════════════════════════════════════════════════════════════════════════════

describe("Developer — GET /submissions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the developer's submissions", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(PROFILE as never);
    vi.mocked(prisma.moduleSubmission.findMany).mockResolvedValueOnce([SUBMISSION] as never);

    const res = await request(app()).get("/submissions");
    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.submissions[0].key).toBe("my-module");
  });

  it("returns 404 when no profile found", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(null);

    const res = await request(app()).get("/submissions");
    expect(res.status).toBe(404);
  });

  it("returns empty array when no submissions yet", async () => {
    vi.mocked(prisma.developerProfile.findUnique).mockResolvedValueOnce(PROFILE as never);
    vi.mocked(prisma.moduleSubmission.findMany).mockResolvedValueOnce([] as never);

    const res = await request(app()).get("/submissions");
    expect(res.status).toBe(200);
    expect(res.body.submissions).toHaveLength(0);
  });
});
