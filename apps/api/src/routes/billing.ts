import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../lib/prisma";
import { cacheGet, cacheSet, cacheDel } from "../lib/cache";
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  getStripeClient,
  getInvoicesAndPaymentMethod,
} from "../services/stripeService";
import { platformSettings } from "./sadmin";

export const billingRouter = Router();

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";

// GET /api/billing/plans — plan configs (member limits, prices, features) for regular users
billingRouter.get("/plans", requireAuth, (_req, res) => {
  res.json({ plans: platformSettings.planConfigs });
});

// GET /api/billing/status — current billing info for the org
billingRouter.get("/status", requireAuth, async (req, res, next) => {
  try {
    const { orgId } = req.user!;
    const stripeConfigured = !!getStripeClient();

    // No org on this session (e.g. platform admin without membership) — return safe defaults
    if (!orgId) {
      return res.json({
        plan: "starter",
        status: "trial",
        trialEnds: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        hasPaymentMethod: false,
        stripeConfigured,
      });
    }

    const ck = `billing:status:${orgId}`;
    const cached = await cacheGet(ck);
    if (cached) return res.json(cached);

    const org = await (prisma.organization.findUnique as (a: unknown) => Promise<{
      plan: string; status: string; trialEnds: Date; stripeCustomerId: string | null;
    } | null>)({
      where: { id: orgId },
      select: { plan: true, status: true, trialEnds: true, stripeCustomerId: true },
    });
    if (!org) throw new AppError(404, "Organization not found");

    const payload = {
      plan: org.plan,
      status: org.status,
      trialEnds: org.trialEnds,
      hasPaymentMethod: !!org.stripeCustomerId,
      stripeConfigured,
    };
    await cacheSet(ck, payload, 60);
    res.json(payload);
  } catch (err) { next(err); }
});

// POST /api/billing/checkout — create Stripe Checkout session
billingRouter.post("/checkout", requireAuth, async (req, res, next) => {
  try {
    if (!getStripeClient()) throw new AppError(503, "Billing is not configured on this server");

    const { plan, userCount } = z.object({
      plan:      z.enum(["starter", "growth", "pro", "enterprise"]),
      userCount: z.number().int().min(1).max(10000).optional().default(1),
      annual:    z.boolean().optional().default(false),
    }).parse(req.body);

    const { orgId, userId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization linked to this session. Please re-login.");

    const [org, user] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);
    if (!org || !user) throw new AppError(404, "Organization or user not found");

    const url = await createCheckoutSession({
      orgId,
      plan,
      userCount,
      email: user.email,
      orgName: org.name,
      successUrl: `${WEB_URL}/dashboard/billing?success=1`,
      cancelUrl:  `${WEB_URL}/dashboard/billing?cancelled=1`,
    });

    res.json({ url });
  } catch (err) {
    if (err instanceof z.ZodError) next(new AppError(400, err.message ?? "Validation error"));
    else next(err);
  }
});

// POST /api/billing/portal — create Stripe Customer Portal session
billingRouter.post("/portal", requireAuth, async (req, res, next) => {
  try {
    if (!getStripeClient()) throw new AppError(503, "Billing is not configured on this server");

    const { orgId } = req.user!;
    if (!orgId) throw new AppError(400, "No organization linked to this session. Please re-login.");

    const url = await createPortalSession(orgId, `${WEB_URL}/dashboard/billing`);
    res.json({ url });
  } catch (err) { next(err); }
});

// GET /api/billing/invoices — invoice history + payment method for the org
billingRouter.get("/invoices", requireAuth, async (req, res, next) => {
  try {
    const { orgId } = req.user!;
    if (!orgId || !getStripeClient()) return res.json({ invoices: [], paymentMethod: null });
    const data = await getInvoicesAndPaymentMethod(orgId);
    res.json(data);
  } catch (err) { next(err); }
});

// POST /api/billing/webhook — Stripe webhook (raw body required)
billingRouter.post(
  "/webhook",
  // express.raw() is applied specifically in index.ts for this route
  async (req, res, next) => {
    try {
      const sig = req.headers["stripe-signature"] as string;
      if (!sig) throw new AppError(400, "Missing stripe-signature header");

      await handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch (err) { next(err); }
  },
);
