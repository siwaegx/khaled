import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { AppError } from "./errorHandler";

export async function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer b360_")) {
    return next(new AppError(401, "Valid API key required (Authorization: Bearer b360_...)"));
  }

  const key = auth.slice(7); // strip "Bearer "
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  const record = await (prisma.apiKey as unknown as {
    findUnique: (a: unknown) => Promise<{ id: string; organizationId: string; isActive: boolean } | null>;
    update: (a: unknown) => Promise<unknown>;
  }).findUnique({ where: { keyHash, isActive: true } });

  if (!record) return next(new AppError(401, "Invalid or revoked API key"));

  // Non-blocking last-used timestamp update
  (prisma.apiKey as unknown as { update: (a: unknown) => Promise<unknown> })
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  req.user = { userId: "api-key", orgId: record.organizationId, role: "owner", isAdmin: false };
  next();
}
