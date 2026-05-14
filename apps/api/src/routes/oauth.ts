import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";
import type { JwtPayload } from "../types";

export const oauthRouter = Router();

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

function issueJwt(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET ?? "secret", { expiresIn: "7d" });
}

function setCookieAndRedirect(res: import("express").Response, token: string): void {
  res
    .cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    })
    .redirect(`${FRONTEND_URL}/dashboard`);
}

// ─── Google OAuth ────────────────────────────────────────────────────────────

// GET /api/auth/oauth/google — redirect to Google
oauthRouter.get("/google", (_req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "Google OAuth is not configured");
  }
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  `${process.env.API_URL ?? "http://localhost:4000"}/api/auth/oauth/google/callback`,
    response_type: "code",
    scope:         "openid email profile",
    state,
  });
  res.cookie("oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600_000 });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/oauth/google/callback
oauthRouter.get("/google/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code) throw new AppError(400, "Missing OAuth code");
    if (state !== req.cookies["oauth_state"]) throw new AppError(400, "OAuth state mismatch");
    res.clearCookie("oauth_state");

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  `${process.env.API_URL ?? "http://localhost:4000"}/api/auth/oauth/google/callback`,
        grant_type:    "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) throw new AppError(401, "Google OAuth failed");

    // Fetch profile
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as { sub: string; email: string; name: string };

    // Find or create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email:        profile.email,
          name:         profile.name,
          passwordHash: "",
          googleId:     profile.sub,
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.sub },
      });
    }

    const orgMember = await prisma.orgMember.findFirst({ where: { userId: user.id } });
    const token = issueJwt({
      userId:  user.id,
      orgId:   orgMember?.organizationId ?? "",
      role:    orgMember?.role           ?? "member",
      isAdmin: user.isAdmin,
    });
    setCookieAndRedirect(res, token);
  } catch (err) { next(err); }
});

// ─── GitHub OAuth ────────────────────────────────────────────────────────────

// GET /api/auth/oauth/github — redirect to GitHub
oauthRouter.get("/github", (_req, res) => {
  if (!process.env.GITHUB_CLIENT_ID) {
    throw new AppError(503, "GitHub OAuth is not configured");
  }
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope:     "user:email",
    state,
  });
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 600_000 });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/auth/oauth/github/callback
oauthRouter.get("/github/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query as Record<string, string>;
    if (!code) throw new AppError(400, "Missing OAuth code");
    if (state !== req.cookies["oauth_state"]) throw new AppError(400, "OAuth state mismatch");
    res.clearCookie("oauth_state");

    // Exchange code for access_token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) throw new AppError(401, "GitHub OAuth failed");

    // Fetch user profile
    const [profileRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "Business360" } }),
      fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "Business360" } }),
    ]);
    const profile = await profileRes.json() as { id: number; login: string; name: string | null };
    const emails  = await emailsRes.json() as { email: string; primary: boolean; verified: boolean }[];
    const primary = emails.find((e) => e.primary && e.verified);
    if (!primary) throw new AppError(400, "No verified primary email on your GitHub account");

    const githubId = String(profile.id);

    let user = await prisma.user.findFirst({
      where: { OR: [{ githubId }, { email: primary.email }] },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email:        primary.email,
          name:         profile.name ?? profile.login,
          passwordHash: "",
          githubId,
        },
      });
    } else if (!user.githubId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { githubId },
      });
    }

    const orgMember2 = await prisma.orgMember.findFirst({ where: { userId: user.id } });
    const token = issueJwt({
      userId:  user.id,
      orgId:   orgMember2?.organizationId ?? "",
      role:    orgMember2?.role           ?? "member",
      isAdmin: user.isAdmin,
    });
    setCookieAndRedirect(res, token);
  } catch (err) { next(err); }
});
