import crypto from "crypto";
import { prisma } from "../lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function webhooksPending(): boolean {
  return !db.orgWebhook || !db.webhookDelivery;
}

export type WebhookEvent =
  | "lead.created"   | "lead.updated"   | "lead.deleted"
  | "deal.created"   | "deal.updated"
  | "invoice.created"| "invoice.updated"
  | "member.invited" | "member.joined"
  | "task.created"   | "task.updated";

export async function fireWebhook(
  orgId: string,
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  if (webhooksPending()) return;

  let webhooks: Array<{ id: string; url: string; secret: string | null; events: unknown }> = [];
  try {
    webhooks = await db.orgWebhook.findMany({
      where: { organizationId: orgId, isActive: true },
    });
  } catch { return; }

  const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() });

  await Promise.allSettled(
    webhooks
      .filter((wh) => {
        const events = Array.isArray(wh.events) ? wh.events : [];
        return events.length === 0 || events.includes(event);
      })
      .map(async (wh) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Business360-Event": event,
          "X-Business360-Delivery": crypto.randomUUID(),
        };
        if (wh.secret) {
          const sig = crypto
            .createHmac("sha256", wh.secret)
            .update(body)
            .digest("hex");
          headers["X-Business360-Signature"] = `sha256=${sig}`;
        }

        let statusCode: number | null = null;
        let error: string | null = null;
        try {
          const res = await fetch(wh.url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
          statusCode = res.status;
        } catch (err) {
          error = err instanceof Error ? err.message : "Unknown error";
        }

        await db.webhookDelivery.create({
          data: {
            webhookId: wh.id,
            event,
            payload: payload as object,
            statusCode,
            error,
          },
        }).catch(() => {}); // delivery logging is best-effort
      }),
  );
}
