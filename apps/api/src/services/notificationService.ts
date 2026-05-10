import { prisma } from "../lib/prisma";

interface CreateNotificationInput {
  userId: string;
  orgId?: string;
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  href?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function notificationPending(): boolean {
  return !db.notification;
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (notificationPending()) return; // migration not yet applied
  try {
    await db.notification.create({
      data: {
        userId: input.userId,
        orgId:  input.orgId ?? null,
        type:   input.type,
        title:  input.title,
        body:   input.body ?? null,
        entityType: input.entityType ?? null,
        entityId:   input.entityId ?? null,
        href:   input.href ?? null,
      },
    });
  } catch {
    // Non-critical — never block the caller
  }
}

export async function getNotifications(userId: string, limit = 30) {
  if (notificationPending()) return [];
  try {
    return await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function markNotificationsRead(userId: string, ids: string[]): Promise<void> {
  if (notificationPending()) return;
  try {
    await db.notification.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data:  { readAt: new Date() },
    });
  } catch { /* ignore */ }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (notificationPending()) return;
  try {
    await db.notification.updateMany({
      where: { userId, readAt: null },
      data:  { readAt: new Date() },
    });
  } catch { /* ignore */ }
}

export async function deleteNotification(userId: string, id: string): Promise<void> {
  if (notificationPending()) return;
  try {
    await db.notification.deleteMany({ where: { id, userId } });
  } catch { /* ignore */ }
}
