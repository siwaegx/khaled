import { Router } from "express";
import { z } from "zod";
import dns from "dns/promises";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
import { prisma } from "../lib/prisma";
import { AppError } from "../middleware/errorHandler";

// Per-org limiter: 10 webhook creates per 10 minutes
const webhookCreateLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 10,
  keyGenerator: (req) => (req as { user?: { orgId?: string } }).user?.orgId ?? req.ip ?? "anon",
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhooks created, please try again later" },
  skip: () => process.env.NODE_ENV !== "production",
});

// Private IPv4 ranges and loopback — block SSRF
const SSRF_BLOCKED_HOSTS = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1",
  "169.254.169.254",  // AWS/GCP metadata
  "metadata.google.internal",
]);
function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.")          ||
    ip.startsWith("192.168.")     ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("127.")         ||
    ip.startsWith("169.254.")     ||
    ip === "::1"
  );
}
async function assertSafeWebhookUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new AppError(400, "Invalid webhook URL"); }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new AppError(400, "Webhook URL must use http or https");
  }
  const host = parsed.hostname.toLowerCase();
  if (SSRF_BLOCKED_HOSTS.has(host)) {
    throw new AppError(400, "Webhook URL cannot point to internal or metadata addresses");
  }
  // Resolve hostname and check resulting IPs — fail-closed: any DNS error blocks the URL
  try {
    const { address } = await dns.lookup(host);
    if (isPrivateIp(address) || SSRF_BLOCKED_HOSTS.has(address)) {
      throw new AppError(400, "Webhook URL resolves to an internal address");
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    // DNS resolution failure treated as blocked: unresolvable hosts cannot be validated as safe
    throw new AppError(400, "Webhook URL hostname could not be resolved");
  }
}

export const webhooksRouter = Router();
webhooksRouter.use(requireAuth);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function migrationPending(): boolean {
  return !db.orgWebhook || !db.webhookDelivery;
}

const WEBHOOK_EVENTS = [
  "lead.created", "lead.updated", "lead.deleted",
  "deal.created", "deal.updated",
  "invoice.created", "invoice.updated",
  "member.invited", "member.joined",
  "task.created", "task.updated",
] as const;

const createWebhookSchema = z.object({
  url:    z.string().url("Must be a valid URL"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).default([]),
  secret: z.string().min(8).max(128).optional(),
});

const patchWebhookSchema = z.object({
  url:      z.string().url().optional(),
  events:   z.array(z.enum(WEBHOOK_EVENTS)).optional(),
  secret:   z.string().min(8).max(128).nullable().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/webhooks
webhooksRouter.get("/", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId;
    if (!orgId) throw new AppError(400, "No active organization");
    if (migrationPending()) { res.json({ webhooks: [] }); return; }

    const webhooks = await db.orgWebhook.findMany({
      where: { organizationId: orgId },
      include: {
        deliveries: {
          orderBy: { sentAt: "desc" },
          take: 5,
          select: { id: true, event: true, statusCode: true, sentAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ webhooks });
  } catch (err) { next(err); }
});

// POST /api/webhooks
webhooksRouter.post("/", webhookCreateLimiter, requireRole("owner"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    if (migrationPending()) {
      res.status(503).json({ error: "Run database migration to enable Webhooks." });
      return;
    }
    const data = createWebhookSchema.parse(req.body);
    await assertSafeWebhookUrl(data.url);
    const webhook = await db.orgWebhook.create({
      data: {
        organizationId: orgId,
        url: data.url,
        events: data.events,
        secret: data.secret ?? null,
      },
    });
    res.status(201).json({ webhook });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});

// PATCH /api/webhooks/:id
webhooksRouter.patch("/:id", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    if (migrationPending()) { res.status(503).json({ error: "Run database migration." }); return; }

    const data = patchWebhookSchema.parse(req.body);

    if (data.url) await assertSafeWebhookUrl(data.url);

    // updateMany includes organizationId to atomically verify ownership and write in one op
    const result = await db.orgWebhook.updateMany({
      where: { id: req.params.id, organizationId: orgId },
      data: {
        ...(data.url      !== undefined && { url:      data.url }),
        ...(data.events   !== undefined && { events:   data.events }),
        ...(data.secret   !== undefined && { secret:   data.secret }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    if (result.count === 0) throw new AppError(404, "Webhook not found");
    const updated = await db.orgWebhook.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    res.json({ webhook: updated });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message));
    else next(err);
  }
});

// DELETE /api/webhooks/:id
webhooksRouter.delete("/:id", requireRole("owner"), async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    if (migrationPending()) { res.status(503).json({ error: "Run database migration." }); return; }

    // deleteMany includes organizationId to eliminate TOCTOU between ownership check and write
    const result = await db.orgWebhook.deleteMany({ where: { id: req.params.id, organizationId: orgId } });
    if (result.count === 0) throw new AppError(404, "Webhook not found");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/webhooks/:id/deliveries
webhooksRouter.get("/:id/deliveries", async (req, res, next) => {
  try {
    const orgId = req.user!.orgId!;
    if (migrationPending()) { res.json({ deliveries: [] }); return; }

    const webhook = await db.orgWebhook.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!webhook) throw new AppError(404, "Webhook not found");

    const deliveries = await db.webhookDelivery.findMany({
      where: { webhookId: req.params.id },
      orderBy: { sentAt: "desc" },
      take: 50,
    });
    res.json({ deliveries });
  } catch (err) { next(err); }
});

export { WEBHOOK_EVENTS };
