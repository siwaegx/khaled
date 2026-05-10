import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { registerUser, loginUser } from "../services/authService";
import { sendWelcomeEmail, sendPasswordResetEmail } from "../services/emailService";
import { AppError } from "../middleware/errorHandler";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import type { JwtPayload } from "../types";

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               name: { type: string, minLength: 1 }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Validation error or email already taken
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in and receive a session cookie
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful — sets access_token cookie
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and clear session cookies
 *     responses:
 *       200:
 *         description: Logged out
 */

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get the current authenticated user
 *     responses:
 *       200:
 *         description: Current user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *                 orgId: { type: string, nullable: true }
 *                 role: { type: string, nullable: true }
 *                 isAdmin: { type: boolean }
 *                 impersonated: { type: boolean }
 *       401:
 *         description: Not authenticated
 */

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Always returns success (email leak prevention)
 */

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using a token from email
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */

/**
 * @openapi
 * /api/auth/switch-org:
 *   post:
 *     tags: [Auth]
 *     summary: Switch to a different organization context
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orgId]
 *             properties:
 *               orgId: { type: string }
 *     responses:
 *       200:
 *         description: Switched — new JWT issued in cookie
 *       403:
 *         description: Not a member of that organization
 */

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const user = await registerUser(data);
    sendWelcomeEmail(data.email, data.name).catch(() => {/* non-fatal */});
    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const { token, cookieMaxAge, user } = await loginUser(data.email, data.password);
    res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: cookieMaxAge,
      })
      .json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

authRouter.post("/logout", (_req, res) => {
  res
    .clearCookie("access_token")
    .clearCookie("admin_session")
    .json({ message: "Logged out" });
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new AppError(404, "User not found");
    res.json({ user, orgId: req.user!.orgId, role: req.user!.role, isAdmin: req.user!.isAdmin, impersonated: req.user!.impersonated ?? false });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     z.string().min(8, "New password must be at least 8 characters"),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(404, "User not found");

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(400, "Current password is incorrect");

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.passwordResetToken.create({ data: { userId: user.id, token, expiresAt } });

      const resetUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
      const userForEmail = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
      sendPasswordResetEmail(email, userForEmail?.name ?? "there", resetUrl).catch(() => {/* non-fatal */});
    }

    // Always return success — don't leak whether the email exists
    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = z.object({
      token:    z.string().min(1),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }).parse(req.body);

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppError(400, "Reset link is invalid or has expired");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// POST /switch-org — re-issue JWT for a different org the user is a member of
authRouter.post("/switch-org", requireAuth, async (req, res, next) => {
  try {
    const { orgId } = z.object({ orgId: z.string().min(1) }).parse(req.body);
    const { userId } = req.user!;

    const membership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: userId!, organizationId: orgId } },
      include: { user: { select: { isAdmin: true } } },
    });
    if (!membership) throw new AppError(403, "You are not a member of this organization");

    const payload: JwtPayload = {
      userId: userId!,
      orgId,
      role: membership.role as "owner" | "manager" | "member",
      isAdmin: membership.user.isAdmin,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET ?? "secret", { expiresIn: "7d" });

    res
      .cookie("access_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

authRouter.post("/exit-impersonation", async (req, res, next) => {
  try {
    const adminToken = req.cookies["admin_session"] as string | undefined;
    if (!adminToken) throw new AppError(400, "No active impersonation session");

    let payload: JwtPayload;
    try {
      payload = jwt.verify(adminToken, process.env.JWT_SECRET ?? "secret") as JwtPayload;
    } catch {
      throw new AppError(401, "Admin session expired — please log in again");
    }
    if (!payload.isAdmin) throw new AppError(403, "Invalid admin session");

    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 8 * 60 * 60 * 1000,
    };

    res
      .cookie("access_token", adminToken, cookieOpts)
      .clearCookie("admin_session")
      .json({ success: true });
  } catch (err) { next(err); }
});
