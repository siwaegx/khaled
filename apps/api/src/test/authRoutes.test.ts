import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    orgMember: { findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    userSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("../services/authService", () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
}));

import { authRouter } from "../routes/auth";
import { errorHandler } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { registerUser, loginUser } from "../services/authService";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRouter);
  app.use(errorHandler);
  return app;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 201 and user on success", async () => {
    vi.mocked(registerUser).mockResolvedValue({ id: "u1", email: "a@b.com", name: "Alice" } as never);
    const res = await request(makeApp())
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "password123", name: "Alice" });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("a@b.com");
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(makeApp())
      .post("/api/auth/register")
      .send({ email: "not-an-email", password: "password123", name: "Alice" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await request(makeApp())
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "short", name: "Alice" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing name", async () => {
    const res = await request(makeApp())
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "password123", name: "" });
    expect(res.status).toBe(400);
  });

  it("forwards errors from registerUser (e.g. 409)", async () => {
    const { AppError } = await import("../middleware/errorHandler");
    vi.mocked(registerUser).mockRejectedValue(new AppError(409, "Email already in use"));
    const res = await request(makeApp())
      .post("/api/auth/register")
      .send({ email: "a@b.com", password: "password123", name: "Alice" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email already in use");
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 200, sets cookie, and returns user on success", async () => {
    vi.mocked(loginUser).mockResolvedValue({
      token: "tok123",
      cookieMaxAge: 604800000,
      user: { id: "u1", email: "a@b.com", name: "Alice" },
    });
    const res = await request(makeApp())
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("a@b.com");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(res.headers["set-cookie"][0]).toMatch(/access_token/);
  });

  it("returns 400 for missing email", async () => {
    const res = await request(makeApp())
      .post("/api/auth/login")
      .send({ password: "password123" });
    expect(res.status).toBe(400);
  });

  it("returns 401 on bad credentials", async () => {
    const { AppError } = await import("../middleware/errorHandler");
    vi.mocked(loginUser).mockRejectedValue(new AppError(401, "Invalid credentials"));
    const res = await request(makeApp())
      .post("/api/auth/login")
      .send({ email: "a@b.com", password: "wrong" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials");
  });
});

describe("POST /api/auth/logout", () => {
  it("clears cookie and returns message", async () => {
    const res = await request(makeApp()).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out");
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 with no cookie", async () => {
    const res = await request(makeApp()).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns user data with valid token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1", email: "a@b.com", name: "Alice",
    } as never);
    const token = jwt.sign(
      { userId: "u1", orgId: "org1", role: "owner" },
      process.env.JWT_SECRET ?? "secret",
      { expiresIn: "1h" }
    );
    const res = await request(makeApp())
      .get("/api/auth/me")
      .set("Cookie", `access_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("a@b.com");
    expect(res.body.orgId).toBe("org1");
    expect(res.body.role).toBe("owner");
  });

  it("returns 404 when user not in DB", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const token = jwt.sign(
      { userId: "gone", orgId: "org1", role: "owner" },
      process.env.JWT_SECRET ?? "secret",
      { expiresIn: "1h" }
    );
    const res = await request(makeApp())
      .get("/api/auth/me")
      .set("Cookie", `access_token=${token}`);
    expect(res.status).toBe(404);
  });
});
