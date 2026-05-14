import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types";
import { AppError } from "./errorHandler";
import { prisma } from "../lib/prisma";

function hashToken(t: string) {
  return crypto.createHash("sha256").update(t).digest("hex");
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies["access_token"] as string | undefined;
  if (!token) return next(new AppError(401, "Unauthorized"));

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET ?? "secret") as JwtPayload;
  } catch {
    return next(new AppError(401, "Invalid or expired token"));
  }

  req.user = payload;

  const tokenHash = hashToken(token);

  // Touch lastUsedAt + check revocation + check role-change invalidation (all in one DB round-trip)
  Promise.all([
    // Session revocation check
    prisma.userSession.findUnique({
      where: { tokenHash },
      select: { revokedAt: true },
    }).then((session) => {
      if (session?.revokedAt) throw new AppError(401, "Session has been revoked. Please log in again.");
      // Touch lastUsedAt (best-effort, not awaited)
      if (session) {
        prisma.userSession.update({ where: { tokenHash }, data: { lastUsedAt: new Date() } }).catch(() => {});
      }
    }),
    // Role-change invalidation (only if org-scoped token)
    payload.orgId && payload.iat
      ? prisma.orgMember.findUnique({
          where: { userId_organizationId: { userId: payload.userId, organizationId: payload.orgId } },
          select: { tokenIssuedBefore: true },
        }).then((member) => {
          const issuedAt = new Date(payload.iat! * 1000);
          if (member?.tokenIssuedBefore && issuedAt < member.tokenIssuedBefore) {
            throw new AppError(401, "Your session has been invalidated due to a role change. Please re-login.");
          }
        })
      : Promise.resolve(),
  ])
    .then(() => next())
    .catch((err) => {
      if (err instanceof AppError) return next(err);
      // Fail-closed: if session/revocation DB checks fail, deny access.
      // Prevents revoked tokens from remaining valid during a DB outage.
      next(new AppError(503, "Authentication service unavailable. Please try again."));
    });
}
