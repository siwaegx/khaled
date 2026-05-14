import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    orgMember: {
      findFirst: vi.fn(),
    },
    userSession: {
      create: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { registerUser, loginUser } from "../services/authService";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

describe("registerUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 409 if email already in use", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "existing" } as never);
    await expect(registerUser({ email: "a@b.com", password: "pass1234", name: "Test" }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates user and returns without passwordHash", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "Test",
    } as never);
    const user = await registerUser({ email: "a@b.com", password: "pass1234", name: "Test" });
    expect(user).toEqual({ id: "u1", email: "a@b.com", name: "Test" });
    expect(prisma.user.create).toHaveBeenCalledOnce();
    const callArg = vi.mocked(prisma.user.create).mock.calls[0]![0];
    expect((callArg as { data: { passwordHash?: string } }).data.passwordHash).toBeDefined();
    expect((callArg as { data: { passwordHash?: string } }).data.passwordHash).not.toBe("pass1234");
  });

  it("hashes the password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockImplementation(async (args) => {
      const { data } = args as { data: { passwordHash: string; email: string; name: string } };
      const valid = await bcrypt.compare("pass1234", data.passwordHash);
      expect(valid).toBe(true);
      return { id: "u1", email: data.email, name: data.name } as never;
    });
    await registerUser({ email: "a@b.com", password: "pass1234", name: "Test" });
  });
});

describe("loginUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws 401 if user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(loginUser("no@one.com", "pass1234"))
      .rejects.toMatchObject({ statusCode: 401, message: "Invalid credentials" });
  });

  it("throws 401 if password invalid", async () => {
    const hash = await bcrypt.hash("correct", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "A", passwordHash: hash,
    } as never);
    await expect(loginUser("a@b.com", "wrong"))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns token and user on success", async () => {
    const hash = await bcrypt.hash("pass1234", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "Alice", passwordHash: hash,
    } as never);
    vi.mocked(prisma.orgMember.findFirst).mockResolvedValue({
      organizationId: "org1", role: "owner",
    } as never);

    const result = await loginUser("a@b.com", "pass1234");
    expect(result.token).toBeTruthy();
    expect(result.user).toEqual({ id: "u1", email: "a@b.com", name: "Alice" });
    expect(result.cookieMaxAge).toBeGreaterThan(0);
  });

  it("sets empty orgId when user has no org", async () => {
    const hash = await bcrypt.hash("pass1234", 4);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "Alice", passwordHash: hash,
    } as never);
    vi.mocked(prisma.orgMember.findFirst).mockResolvedValue(null);

    const result = await loginUser("a@b.com", "pass1234");
    expect(result.token).toBeTruthy();
  });
});
