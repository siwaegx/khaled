import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import jwt from "jsonwebtoken";

vi.mock("../lib/prisma", () => ({
  prisma: {
    userSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
    },
    orgMember: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

import { requireAuth } from "../middleware/requireAuth";
import { errorHandler } from "../middleware/errorHandler";

const JWT_SECRET = "test-secret";

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
  app.use(errorHandler);
  return app;
}

function makeToken(payload = { userId: "u1", orgId: "org1", role: "owner" }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

describe("requireAuth middleware", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET };
  });

  it("returns 401 with no cookie", async () => {
    const res = await request(makeApp()).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(makeApp())
      .get("/protected")
      .set("Cookie", "access_token=bad.token.here");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("returns 401 with expired token", async () => {
    const token = jwt.sign({ userId: "u1", orgId: "org1", role: "owner" }, JWT_SECRET, { expiresIn: -1 });
    const res = await request(makeApp())
      .get("/protected")
      .set("Cookie", `access_token=${token}`);
    expect(res.status).toBe(401);
  });

  it("attaches user payload and calls next on valid token", async () => {
    const token = makeToken({ userId: "user123", orgId: "org456", role: "admin" });
    const res = await request(makeApp())
      .get("/protected")
      .set("Cookie", `access_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe("user123");
    expect(res.body.user.orgId).toBe("org456");
    expect(res.body.user.role).toBe("admin");
  });
});
