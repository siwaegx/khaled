import type { Request, Response, NextFunction } from "express";
import { fireWebhook } from "../services/webhookService";
import { createNotification } from "../services/notificationService";
import type { HookEvent } from "@business360/module-sdk";

const HOOK_NOTIFICATION_MAP: Partial<Record<HookEvent, { type: string; titleFn: (p: Record<string, unknown>) => string; hrefFn?: (p: Record<string, unknown>) => string }>> = {
  "lead.created":    { type: "lead_created",    titleFn: (p) => `New lead: ${p["name"] ?? "Unknown"}`, hrefFn: () => "/dashboard/crm/leads" },
  "deal.created":    { type: "deal_created",     titleFn: (p) => `New deal: ${p["title"] ?? "Unknown"}`, hrefFn: () => "/dashboard/crm/deals" },
  "invoice.created": { type: "invoice_created",  titleFn: (p) => `Invoice created: ${p["number"] ?? ""}`, hrefFn: () => "/dashboard/accounting/invoices" },
  "task.created":    { type: "task_created",     titleFn: (p) => `New task: ${p["title"] ?? "Unknown"}`, hrefFn: () => "/dashboard/projects/tasks" },
  "calendar.created":{ type: "calendar_created", titleFn: (p) => `New event: ${p["title"] ?? "Unknown"}`, hrefFn: () => "/dashboard/calendar" },
};

export function attachHookService(req: Request, _res: Response, next: NextFunction): void {
  const orgId  = req.user?.orgId;
  const userId = req.user?.userId;

  req.hookService = {
    async fire(event: HookEvent, payload: Record<string, unknown>): Promise<void> {
      const promises: Promise<void>[] = [];

      if (orgId) {
        promises.push(fireWebhook(orgId, event as Parameters<typeof fireWebhook>[1], payload));
      }

      const notifDef = HOOK_NOTIFICATION_MAP[event];
      if (notifDef && userId && orgId) {
        promises.push(
          createNotification({
            userId,
            orgId,
            type:       notifDef.type,
            title:      notifDef.titleFn(payload),
            entityType: event.split(".")[0],
            entityId:   String(payload["id"] ?? ""),
            href:       notifDef.hrefFn?.(payload),
          }),
        );
      }

      await Promise.allSettled(promises);
    },
  };

  next();
}
