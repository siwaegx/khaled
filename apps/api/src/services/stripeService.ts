// eslint-disable-next-line @typescript-eslint/no-require-imports
const StripeLib = require("stripe") as typeof import("stripe");

const stripe = process.env.STRIPE_SECRET_KEY
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  ? (new (StripeLib as unknown as new (key: string) => StripeInstance)(process.env.STRIPE_SECRET_KEY))
  : null;

// Minimal shape of the Stripe client methods we use
interface StripeInstance {
  customers: {
    create(params: { email: string; name: string; metadata: Record<string, string> }): Promise<{ id: string }>;
  };
  checkout: {
    sessions: {
      create(params: unknown): Promise<{ url: string | null }>;
    };
  };
  billingPortal: {
    sessions: {
      create(params: { customer: string; return_url: string }): Promise<{ url: string }>;
    };
  };
  webhooks: {
    constructEvent(body: Buffer, sig: string, secret: string): {
      type: string;
      data: { object: Record<string, unknown> };
    };
  };
  invoices: {
    list(params: { customer: string; limit: number }): Promise<{
      data: Array<{
        id: string;
        number: string | null;
        created: number;
        amount_paid: number;
        currency: string;
        status: string | null;
        invoice_pdf: string | null;
        hosted_invoice_url: string | null;
      }>;
    }>;
  };
  paymentMethods: {
    list(params: { customer: string; type: string; limit: number }): Promise<{
      data: Array<{
        id: string;
        card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
      }>;
    }>;
  };
}

export type InvoiceItem = {
  id: string;
  number: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
};

export type PaymentMethodInfo = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

import { prisma } from "../lib/prisma";

const PRICE_IDS: Record<string, string | undefined> = {
  starter:    process.env.STRIPE_PRICE_STARTER,
  growth:     process.env.STRIPE_PRICE_GROWTH,
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export function getStripeClient(): StripeInstance | null {
  return stripe;
}

export async function getOrCreateStripeCustomer(orgId: string, email: string, orgName: string): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");

  const org = await (prisma.organization.findUnique as (args: unknown) => Promise<{ stripeCustomerId?: string | null } | null>)({
    where: { id: orgId }, select: { stripeCustomerId: true },
  });

  if (org?.stripeCustomerId) return org.stripeCustomerId;

  const customer = await stripe.customers.create({ email, name: orgName, metadata: { orgId } });

  await (prisma.organization.update as (args: unknown) => Promise<unknown>)({
    where: { id: orgId }, data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

export async function createCheckoutSession(opts: {
  orgId: string; plan: string; email: string; orgName: string;
  successUrl: string; cancelUrl: string;
}): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");

  const priceId = PRICE_IDS[opts.plan];
  if (!priceId) throw new Error(`No Stripe price configured for plan: ${opts.plan}`);

  const customerId = await getOrCreateStripeCustomer(opts.orgId, opts.email, opts.orgName);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { orgId: opts.orgId, plan: opts.plan },
    subscription_data: { metadata: { orgId: opts.orgId, plan: opts.plan } },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL. Please try again.");
  return session.url;;
}

export async function createPortalSession(orgId: string, returnUrl: string): Promise<string> {
  if (!stripe) throw new Error("Stripe is not configured");

  const org = await (prisma.organization.findUnique as (args: unknown) => Promise<{ stripeCustomerId?: string | null } | null>)({
    where: { id: orgId }, select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) throw new Error("No billing account found. Please upgrade first.");

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
  if (!stripe) throw new Error("Stripe is not configured");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new Error("Invalid webhook signature");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session["metadata"] as Record<string, string> | undefined;
    const orgId = meta?.orgId;
    const plan = meta?.plan as "starter" | "growth" | "pro" | "enterprise" | undefined;

    if (orgId && plan) {
      await prisma.organization.update({ where: { id: orgId }, data: { plan, status: "active" } });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const meta = sub["metadata"] as Record<string, string> | undefined;
    const orgId = meta?.orgId;
    if (orgId) {
      await prisma.organization.update({ where: { id: orgId }, data: { plan: "starter", status: "trial" } });
    }
  }
}

export async function getInvoicesAndPaymentMethod(orgId: string): Promise<{
  invoices: InvoiceItem[];
  paymentMethod: PaymentMethodInfo | null;
}> {
  if (!stripe) return { invoices: [], paymentMethod: null };

  const org = await (prisma.organization.findUnique as (args: unknown) => Promise<{ stripeCustomerId?: string | null } | null>)({
    where: { id: orgId }, select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) return { invoices: [], paymentMethod: null };

  const [invoicesRes, pmRes] = await Promise.all([
    stripe.invoices.list({ customer: org.stripeCustomerId, limit: 12 }),
    stripe.paymentMethods.list({ customer: org.stripeCustomerId, type: "card", limit: 1 }),
  ]);

  const invoices: InvoiceItem[] = invoicesRes.data.map((inv) => ({
    id: inv.id,
    number: inv.number ?? inv.id,
    date: new Date(inv.created * 1000).toISOString(),
    amount: inv.amount_paid,
    currency: inv.currency,
    status: inv.status ?? "unknown",
    pdfUrl: inv.invoice_pdf,
    hostedUrl: inv.hosted_invoice_url,
  }));

  const pm = pmRes.data[0];
  const paymentMethod: PaymentMethodInfo | null = pm?.card
    ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }
    : null;

  return { invoices, paymentMethod };
}
