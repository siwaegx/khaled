import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);
apiKeysRouter.use(requireRole("owner")); // Only org owners can manage API keys

type ApiKeyRecord = { id: string; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null; isActive: boolean };

const apiKeyPrisma = prisma.apiKey as unknown as {
  findMany: (a: unknown) => Promise<ApiKeyRecord[]>;
  create: (a: unknown) => Promise<ApiKeyRecord>;
  update: (a: unknown) => Promise<ApiKeyRecord>;
  delete: (a: unknown) => Promise<void>;
};

// GET /api/org/api-keys — list keys for this org (never returns the full key)
apiKeysRouter.get("/", async (req, res, next) => {
  try {
    const { orgId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization");

    const keys = await apiKeyPrisma.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ keys: keys.map(({ id, name, prefix, createdAt, lastUsedAt }) => ({ id, name, prefix, createdAt, lastUsedAt })) });
  } catch (err) { next(err); }
});

// POST /api/org/api-keys — create a new key (returns full key ONCE)
apiKeysRouter.post("/", async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(req.body);
    const { orgId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization");

    const rawKey  = `b360_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const prefix  = rawKey.slice(0, 12); // "b360_xxxxxxx" — safe to display

    const record = await apiKeyPrisma.create({
      data: { organizationId: orgId, name, keyHash, prefix },
    });

    res.status(201).json({
      key: record,
      secret: rawKey, // returned ONCE — store it now, it cannot be retrieved again
    });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.errors[0]?.message ?? "Validation error"));
    else next(err);
  }
});

// DELETE /api/org/api-keys/:id — revoke a key
apiKeysRouter.delete("/:id", async (req, res, next) => {
  try {
    const { orgId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization");

    await apiKeyPrisma.update({
      where: { id: req.params["id"]! },
      data: { isActive: false },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});
