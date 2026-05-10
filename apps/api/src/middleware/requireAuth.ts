import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types";
import { AppError } from "./errorHandler";
import { prisma } from "../lib/prisma";

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

  // Check token freshness when the token carries an org context.
  // tokenIssuedBefore is set on OrgMember whenever the role is changed;
  // tokens issued before that timestamp are treated as stale.
  if (!payload.orgId || !payload.iat) return next();

  const issuedAt = new Date(payload.iat * 1000);
  prisma.orgMember
    .findUnique({
      where: { userId_organizationId: { userId: payload.userId, organizationId: payload.orgId } },
      select: { tokenIssuedBefore: true },
    })
    .then((member) => {
      if (member?.tokenIssuedBefore && issuedAt < member.tokenIssuedBefore) {
        return next(new AppError(401, "Your session has been invalidated due to a role change. Please re-login."));
      }
      next();
    })
    .catch(() => next()); // DB failure → allow (fail-open, not fail-closed)
}
