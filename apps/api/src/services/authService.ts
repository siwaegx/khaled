import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import type { JwtPayload } from "../types";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, "Email already in use");

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: { email: data.email, name: data.name, passwordHash },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError(401, "Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(401, "Invalid credentials");

  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  const payload: JwtPayload = {
    userId: user.id,
    orgId: orgMember?.organizationId ?? "",
    role: orgMember?.role ?? "member",
    isAdmin: user.isAdmin,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET ?? "secret", { expiresIn: "7d" });

  // Record session for management UI (best-effort)
  prisma.userSession.create({
    data: { userId: user.id, tokenHash: hashToken(token) },
  }).catch(() => {});

  return { token, cookieMaxAge: COOKIE_MAX_AGE, user: { id: user.id, email: user.email, name: user.name } };
}
