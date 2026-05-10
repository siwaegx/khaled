import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  deleteNotification,
} from "../services/notificationService";
import { AppError } from "../middleware/errorHandler";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/notifications?limit=30
notificationsRouter.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const notifications = await getNotifications(req.user!.userId, limit);
    const unreadCount = notifications.filter((n: { readAt: unknown }) => !n.readAt).length;
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all
notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user!.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read
notificationsRouter.patch("/read", async (req, res, next) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()).min(1) }).parse(req.body);
    await markNotificationsRead(req.user!.userId, ids);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, "ids must be a non-empty array"));
    else next(err);
  }
});

// DELETE /api/notifications/:id
notificationsRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteNotification(req.user!.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});
