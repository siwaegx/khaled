import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// GET /api/auth/sessions — list active sessions for the current user
sessionsRouter.get("/", async (req, res, next) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: req.user!.userId, revokedAt: null },
      orderBy: { lastUsedAt: "desc" },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastUsedAt: true },
    });
    res.json({ sessions });
  } catch (err) { next(err); }
});

// DELETE /api/auth/sessions/:id — revoke a specific session
sessionsRouter.delete("/:id", async (req, res, next) => {
  try {
    const session = await prisma.userSession.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (!session) throw new AppError(404, "Session not found");
    if (session.userId !== req.user!.userId) throw new AppError(403, "Not your session");

    await prisma.userSession.update({
      where: { id: req.params.id },
      data: { revokedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/auth/sessions — revoke all sessions except the current one
sessionsRouter.delete("/", async (req, res, next) => {
  try {
    const token = req.cookies["access_token"] as string | undefined;
    const currentHash = token ? hashToken(token) : null;

    await prisma.userSession.updateMany({
      where: {
        userId: req.user!.userId,
        revokedAt: null,
        ...(currentHash ? { tokenHash: { not: currentHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Helper exported for use in auth routes to record sessions
export { hashToken };
