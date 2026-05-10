"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CreditCard, CheckCircle, AlertCircle, ExternalLink,
  Check, X, Star, ArrowRight, Sparkles, Zap, Shield,
  Headphones, Download, FileText, ChevronDown, ChevronUp, Users,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */

type BillingStatus = {
  plan: string; status: string; trialEnds: string;
  hasPaymentMethod: boolean; stripeConfigured: boolean;
};

type PlanFeature = { text: string; included: boolean };

type PlanConfig = {
  key: string; name: string; description: string;
  price: number; yearlyPrice: number;
  memberLimit: number; // 0 = unlimited
  isPopular: boolean; ctaText: string;
  features: PlanFeature[];
};

type InvoiceItem = {
  id: string; number: string; date: string;
  amount: number; currency: string; status: string;
  pdfUrl: string | null; hostedUrl: string | null;
};

type PaymentMethodInfo = {
  brand: string; last4: string; expMonth: number; expYear: number;
};

type PlanKey = "starter" | "growth" | "pro" | "enterprise";

/* ─── Static UI metadata (styling only, not plan data) ───── */

const PLAN_ORDER: PlanKey[] = ["starter", "growth", "pro", "enterprise"];

const PLAN_UI: Record<string, {
  gradient: string;
  icon: React.ElementType;
  modules: string[];
}> = {
  starter:    { gradient: "from-blue-500 to-cyan-500",     icon: Zap,        modules: ["CRM", "Contacts"] },
  growth:     { gradient: "from-emerald-500 to-teal-500",  icon: Sparkles,   modules: ["CRM", "Contacts", "Inventory"] },
  pro:        { gradient: "from-violet-500 to-purple-600", icon: Shield,     modules: ["CRM", "Contacts", "Inventory", "Accounting", "HR"] },
  enterprise: { gradient: "from-amber-500 to-orange-500",  icon: Headphones, modules: ["CRM", "Contacts", "Inventory", "Accounting", "HR", "Projects", "Reports"] },
};

/* ─── Helpers ────────────────────────────────────────────── */

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", jcb: "JCB", unionpay: "UnionPay",
};

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: currency.toUpperCase(), minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function memberLimitLabel(limit: number) {
  return limit === 0 ? "Unlimited members" : `Up to ${limit} member${limit !== 1 ? "s" : ""}`;
}

/* ─── Member usage bar ───────────────────────────────────── */

function MemberUsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="w-3.5 h-3.5 shrink-0" />
        <span>{used} member{used !== 1 ? "s" : ""} · Unlimited capacity</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const isNear = pct >= 80;
  const isFull = pct >= 95;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="w-3.5 h-3.5 shrink-0" />
          <span>Members</span>
        </div>
        <span className={cn(
          "font-semibold tabular-nums",
          isFull ? "text-rose-600" : isNear ? "text-amber-600" : "text-foreground"
        )}>
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isFull ? "bg-rose-500" : isNear ? "bg-amber-500" : "bg-emerald-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isNear && (
        <p className={cn("text-[10px]", isFull ? "text-rose-600" : "text-amber-600")}>
          {isFull
            ? "Seat limit reached — upgrade to add more members."
            : `${limit - used} seat${limit - used !== 1 ? "s" : ""} remaining. Upgrade for more.`}
        </p>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────── */

export default function BillingPage() {
  const { org } = useAuth();
  const [status, setStatus]             = useState<BillingStatus | null>(null);
  const [planConfigs, setPlanConfigs]   = useState<PlanConfig[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  const [annual, setAnnual]             = useState(false);
  const [upgrading, setUpgrading]       = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [invoices, setInvoices]         = useState<InvoiceItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showAllInvoices, setShowAllInvoices] = useState(false);
  const [showTable, setShowTable]       = useState(false);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  const searchParams =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const successMsg   = searchParams?.get("success");
  const cancelledMsg = searchParams?.get("cancelled");

  useEffect(() => {
    Promise.all([
      apiGet<BillingStatus>("/api/billing/status"),
      apiGet<{ plans: PlanConfig[] }>("/api/billing/plans"),
    ])
      .then(([s, p]) => { setStatus(s); setPlanConfigs(p.plans); })
      .catch(() => toast.error("Failed to load billing info"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoadingInvoices(true);
    apiGet<{ invoices: InvoiceItem[]; paymentMethod: PaymentMethodInfo | null }>("/api/billing/invoices")
      .then((d) => { setInvoices(d.invoices); setPaymentMethod(d.paymentMethod); })
      .catch(() => {})
      .finally(() => setLoadingInvoices(false));
  }, []);

  async function handleUpgrade() {
    if (!selectedPlan) return;
    if (!status?.stripeConfigured) {
      toast.error("Payment processing isn't configured yet. Please contact your administrator.");
      return;
    }
    // Intercept downgrades — require explicit confirmation
    const idx = PLAN_ORDER.indexOf(selectedPlan);
    if (idx < currentPlanIdx) {
      setShowDowngradeModal(true);
      return;
    }
    await proceedToCheckout();
  }

  async function proceedToCheckout() {
    if (!selectedPlan) return;
    setShowDowngradeModal(false);
    setUpgrading(true);
    try {
      const data = await apiPost<{ url: string }>("/api/billing/checkout", { plan: selectedPlan, annual });
      window.location.href = data.url;
    } catch {
      toast.error("Failed to start checkout. Please try again.");
      setUpgrading(false);
    }
  }

  async function handlePortal() {
    setOpeningPortal(true);
    try {
      const data = await apiPost<{ url: string }>("/api/billing/portal", {});
      window.location.href = data.url;
    } catch {
      toast.error("Failed to open billing portal.");
      setOpeningPortal(false);
    }
  }

  const currentPlanKey = (status?.plan ?? org?.plan ?? "starter") as PlanKey;
  const currentPlanIdx = PLAN_ORDER.indexOf(currentPlanKey);
  const onTrial        = status?.status === "trial";
  const trialDaysLeft  = status?.trialEnds
    ? Math.max(0, Math.ceil((new Date(status.trialEnds).getTime() - Date.now()) / 86_400_000))
    : 0;

  const selectedPlanData = selectedPlan ? planConfigs.find((p) => p.key === selectedPlan) : null;
  const selectedIdx      = selectedPlan ? PLAN_ORDER.indexOf(selectedPlan) : -1;
  const isUpgrade        = selectedIdx > currentPlanIdx;

  const currentConfig    = planConfigs.find((p) => p.key === currentPlanKey);
  const memberUsed       = org?.userCount ?? 0;
  const memberLimit      = currentConfig?.memberLimit ?? 0;

  // Build comparison rows — member limits come from API, rest is static
  const comparisonRows = useMemo(() => {
    if (planConfigs.length === 0) return [];
    const getLimit = (key: string) => {
      const c = planConfigs.find((p) => p.key === key);
      return c ? (c.memberLimit === 0 ? "Unlimited" : String(c.memberLimit)) : "—";
    };
    return [
      { label: "Members",             values: [getLimit("starter"), getLimit("growth"), getLimit("pro"), getLimit("enterprise")] as [string, string, string, string] },
      { label: "Modules",             values: ["CRM only",  "Core",     "All",      "All"]        as [string, string, string, string] },
      { label: "Storage",             values: ["5 GB",      "25 GB",    "100 GB",   "Unlimited"]  as [string, string, string, string] },
      { label: "Support",             values: ["Email",     "Priority", "Dedicated","SLA"]        as [string, string, string, string] },
      { label: "Custom reports",      values: [false,       true,       true,       true]         as [boolean, boolean, boolean, boolean] },
      { label: "Custom integrations", values: [false,       false,      true,       true]         as [boolean, boolean, boolean, boolean] },
      { label: "White-label",         values: [false,       false,      true,       true]         as [boolean, boolean, boolean, boolean] },
      { label: "API access",          values: [true,        true,       true,       true]         as [boolean, boolean, boolean, boolean] },
      { label: "On-premise",          values: [false,       false,      false,      true]         as [boolean, boolean, boolean, boolean] },
    ];
  }, [planConfigs]);

  const visibleInvoices = showAllInvoices ? invoices : invoices.slice(0, 5);

  const orderedConfigs = PLAN_ORDER
    .map((key) => planConfigs.find((p) => p.key === key))
    .filter(Boolean) as PlanConfig[];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-36 md:pb-12">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Choose the plan that fits your team.</p>
        </div>
        {status?.hasPaymentMethod && (
          <Button variant="outline" size="sm" onClick={handlePortal} disabled={openingPortal}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {openingPortal ? "Opening…" : "Manage Billing"}
          </Button>
        )}
      </div>

      {/* ── Banners ──────────────────────────────────────── */}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span><strong>Payment successful!</strong> Your plan has been upgraded.</span>
        </div>
      )}
      {cancelledMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Checkout cancelled — your plan was not changed.
        </div>
      )}

      {/* ── Current plan status ──────────────────────────── */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm capitalize">{currentPlanKey} Plan</p>
              <p className="text-xs text-muted-foreground">
                {onTrial
                  ? `Free trial · ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} remaining`
                  : "Active subscription"}
              </p>
            </div>
          </div>
          {onTrial && (
            <div className={cn(
              "flex items-center gap-2 text-xs rounded-lg px-3 py-2 border",
              trialDaysLeft <= 3
                ? "text-rose-700 bg-rose-50 border-rose-200"
                : "text-amber-700 bg-amber-50 border-amber-200"
            )}>
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {trialDaysLeft === 0
                ? "Trial ends today — upgrade now."
                : trialDaysLeft <= 3
                  ? `Only ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left! Upgrade to keep access.`
                  : `${trialDaysLeft} days remaining in your free trial.`}
            </div>
          )}
        </div>

        {/* Member usage bar */}
        {!loading && (
          <div className="border-t border-border/50 pt-4">
            <MemberUsageBar used={memberUsed} limit={memberLimit} />
          </div>
        )}

        {!loading && !status?.stripeConfigured && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            Stripe is not configured. Set{" "}
            <code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code> in your API
            environment to enable payments. You can still select a plan to preview.
          </p>
        )}
      </div>

      {/* ── Billing period toggle ────────────────────────── */}
      <div className="flex flex-col items-center gap-2">
        <div className="inline-flex items-center gap-1 bg-muted/60 rounded-2xl p-1.5 border border-border/50">
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
              !annual ? "bg-background shadow text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2",
              annual ? "bg-background shadow text-foreground border border-border/60" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 leading-none">
              Save 20%
            </span>
          </button>
        </div>
        {annual && <p className="text-xs text-muted-foreground">Billed once per year. Cancel anytime.</p>}
      </div>

      {/* ── Plan cards ───────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border/40 bg-muted/20 p-5 animate-pulse h-64" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {orderedConfigs.map((plan) => {
            const ui        = PLAN_UI[plan.key] ?? PLAN_UI["starter"]!;
            const isCurrent = plan.key === currentPlanKey;
            const isSelected = plan.key === selectedPlan;
            const planIdx   = PLAN_ORDER.indexOf(plan.key as PlanKey);
            const isHigher  = planIdx > currentPlanIdx;
            const price     = annual ? plan.yearlyPrice : plan.price;
            const PlanIcon  = ui.icon;
            const currentModules = PLAN_UI[currentPlanKey]?.modules ?? [];
            const newModules = isHigher
              ? ui.modules.filter((m) => !currentModules.includes(m))
              : [];
            const includedFeatures = plan.features.filter((f) => f.included);

            return (
              <div
                key={plan.key}
                onClick={() => setSelectedPlan(isSelected ? null : (plan.key as PlanKey))}
                className={cn(
                  "relative rounded-2xl border-2 p-5 flex flex-col gap-4 transition-all duration-200",
                  isCurrent
                    ? "border-primary/40 bg-primary/5 cursor-default"
                    : isSelected
                      ? "border-primary shadow-lg shadow-primary/10 bg-primary/[0.04] cursor-pointer scale-[1.025]"
                      : "border-border/50 bg-card cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5"
                )}
              >
                {/* Popular badge */}
                {plan.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-2.5 py-1 shadow-sm whitespace-nowrap">
                      <Star className="w-2.5 h-2.5 fill-current" /> Most Popular
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br shrink-0", ui.gradient)}>
                      <PlanIcon className="w-4 h-4 text-white" />
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary rounded-full px-2 py-0.5">Current</span>
                    )}
                    {isSelected && !isCurrent && (
                      <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-base leading-tight">{plan.name}</p>
                  <div className="flex items-baseline gap-0.5 mt-1.5">
                    <span className="text-3xl font-extrabold tracking-tight">${price}</span>
                    <span className="text-sm text-muted-foreground font-normal ml-0.5">/mo</span>
                  </div>
                  {annual && plan.yearlyPrice > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">${price * 12} billed annually</p>
                  )}
                </div>

                {/* Member limit — prominent */}
                <div className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 border",
                  isCurrent || isSelected
                    ? "bg-primary/5 border-primary/25"
                    : "bg-muted/40 border-border/40"
                )}>
                  <Users className={cn("w-4 h-4 shrink-0", isCurrent || isSelected ? "text-primary" : "text-muted-foreground/60")} />
                  <span className={cn("text-xs font-bold", isCurrent || isSelected ? "text-primary" : "text-muted-foreground")}>
                    {memberLimitLabel(plan.memberLimit)}
                  </span>
                </div>

                {/* Features */}
                <ul className="flex-1 space-y-1.5">
                  {includedFeatures.slice(0, 6).map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Check className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", isCurrent || isSelected ? "text-primary" : "text-muted-foreground/40")} />
                      {f.text}
                    </li>
                  ))}
                  {includedFeatures.length > 6 && (
                    <li className="text-[10px] text-muted-foreground/50 pl-5">+{includedFeatures.length - 6} more</li>
                  )}
                </ul>

                {/* Module unlock preview */}
                {isHigher && newModules.length > 0 && (
                  <div className={cn(
                    "rounded-xl border px-3 py-2.5 text-[11px] transition-all duration-200",
                    isSelected ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/30"
                  )}>
                    <p className={cn("font-bold mb-1.5 flex items-center gap-1", isSelected ? "text-primary" : "text-muted-foreground")}>
                      <Sparkles className="w-3 h-3" /> Unlocks
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {newModules.map((m) => (
                        <span key={m} className={cn(
                          "px-1.5 py-0.5 rounded-md text-[10px] font-semibold",
                          isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/60"
                        )}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Card CTA */}
                <div className={cn(
                  "rounded-xl py-2 text-center text-xs font-semibold border transition-all duration-200",
                  isCurrent
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : isHigher
                        ? "border-primary/30 text-primary"
                        : "border-border text-muted-foreground"
                )}>
                  {isCurrent ? "Current plan" : isSelected ? "Selected ✓" : isHigher ? (plan.ctaText || "Select →") : "Downgrade"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Feature comparison table ──────────────────────── */}
      {comparisonRows.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <button
            onClick={() => setShowTable((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <span className="font-semibold text-sm">Compare all features</span>
            {showTable ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showTable && (
            <div className="overflow-x-auto border-t border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground/60 uppercase tracking-widest w-1/3">Feature</th>
                    {orderedConfigs.map((p) => (
                      <th key={p.key} className={cn("px-4 py-3 text-center text-xs font-bold", p.key === currentPlanKey ? "text-primary" : "text-muted-foreground")}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{p.name}</span>
                          {p.key === currentPlanKey && (
                            <span className="text-[9px] font-bold bg-primary/10 text-primary rounded-full px-1.5 py-0.5 leading-none">Current</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.label} className={cn("border-b border-border/50", i % 2 === 0 ? "bg-transparent" : "bg-muted/20")}>
                      <td className="px-5 py-3 text-xs font-medium text-muted-foreground">{row.label}</td>
                      {row.values.map((val, j) => {
                        const planKey = PLAN_ORDER[j]!;
                        const isCur = planKey === currentPlanKey;
                        return (
                          <td key={j} className={cn("px-4 py-3 text-center text-xs", isCur && "bg-primary/5")}>
                            {typeof val === "boolean" ? (
                              val
                                ? <Check className={cn("w-3.5 h-3.5 mx-auto", isCur ? "text-primary" : "text-emerald-500")} />
                                : <X className="w-3.5 h-3.5 mx-auto text-muted-foreground/30" />
                            ) : (
                              <span className={cn("font-semibold", isCur ? "text-primary" : "text-foreground")}>{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Payment method + Invoice history ─────────────── */}
      {(status?.hasPaymentMethod || invoices.length > 0 || loadingInvoices) && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Payment & Invoices</h2>

          {/* Payment method */}
          <div className="rounded-2xl border bg-card p-5 flex items-center justify-between gap-4 flex-wrap">
            {loadingInvoices ? (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-6 bg-muted rounded" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            ) : paymentMethod ? (
              <div className="flex items-center gap-3">
                <div className="px-2 py-1 border border-border rounded text-[11px] font-bold text-muted-foreground uppercase tracking-wide bg-muted/30">
                  {BRAND_LABELS[paymentMethod.brand] ?? paymentMethod.brand}
                </div>
                <div>
                  <p className="text-sm font-medium">•••• •••• •••• {paymentMethod.last4}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {paymentMethod.expMonth.toString().padStart(2, "0")}/{paymentMethod.expYear}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="w-4 h-4" /> No payment method on file
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handlePortal} disabled={openingPortal}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {openingPortal ? "Opening…" : paymentMethod ? "Update card" : "Add payment method"}
            </Button>
          </div>

          {/* Invoice list */}
          {(loadingInvoices || invoices.length > 0) && (
            <div className="rounded-2xl border bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold">Invoice History</p>
                {invoices.length > 0 && (
                  <span className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              {loadingInvoices ? (
                <div className="divide-y divide-border">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center justify-between animate-pulse">
                      <div className="space-y-1.5">
                        <div className="h-3 w-24 bg-muted rounded" />
                        <div className="h-2.5 w-16 bg-muted rounded" />
                      </div>
                      <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-border">
                    {visibleInvoices.map((inv) => (
                      <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{inv.number}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(inv.date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold tabular-nums">{formatAmount(inv.amount, inv.currency)}</span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize",
                            inv.status === "paid"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : inv.status === "open"
                                ? "bg-amber-50 border-amber-200 text-amber-700"
                                : "bg-muted border-border text-muted-foreground"
                          )}>
                            {inv.status}
                          </span>
                          {inv.pdfUrl ? (
                            <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors" title="Download PDF">
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          ) : <div className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  {invoices.length > 5 && (
                    <button
                      onClick={() => setShowAllInvoices((v) => !v)}
                      className="w-full px-5 py-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors border-t border-border flex items-center justify-center gap-1"
                    >
                      {showAllInvoices
                        ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                        : <><ChevronDown className="w-3.5 h-3.5" /> Show {invoices.length - 5} more</>}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Downgrade confirmation modal ──────────────────── */}
      <Dialog open={showDowngradeModal} onOpenChange={setShowDowngradeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlert className="w-5 h-5 text-amber-500" />
              Downgrade to {selectedPlanData?.name}?
            </DialogTitle>
            <DialogDescription>
              This will reduce your plan from{" "}
              <strong className="capitalize">{currentPlanKey}</strong> to{" "}
              <strong>{selectedPlanData?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">You may lose access to:</p>
            <ul className="space-y-1.5 text-sm">
              {(() => {
                const currentModules = PLAN_UI[currentPlanKey]?.modules ?? [];
                const newModules = PLAN_UI[selectedPlan ?? ""]?.modules ?? [];
                const losing = currentModules.filter((m) => !newModules.includes(m));
                if (losing.length === 0) return <li className="text-muted-foreground text-xs">No modules will be removed.</li>;
                return losing.map((m) => (
                  <li key={m} className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <X className="w-3.5 h-3.5 shrink-0" /> {m} module
                  </li>
                ));
              })()}
            </ul>
            {selectedPlanData?.memberLimit !== 0 && memberUsed > (selectedPlanData?.memberLimit ?? 0) && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
                <strong>Warning:</strong> You currently have {memberUsed} members but the{" "}
                {selectedPlanData?.name} plan only allows {selectedPlanData?.memberLimit}.
                Excess members will lose access.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDowngradeModal(false)}>
              Keep current plan
            </Button>
            <Button variant="destructive" onClick={() => void proceedToCheckout()} disabled={upgrading}>
              {upgrading ? "Redirecting…" : "Yes, downgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sticky checkout bar ───────────────────────────── */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 md:relative md:bottom-auto md:z-auto",
        selectedPlanData ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none md:hidden"
      )}>
        <div className="bg-card/95 backdrop-blur-md border-t border-border md:border md:rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl md:shadow-sm">
          <div className="flex items-center gap-3">
            {selectedPlanData && (() => {
              const ui = PLAN_UI[selectedPlanData.key] ?? PLAN_UI["starter"]!;
              const PlanIcon = ui.icon;
              return (
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0", ui.gradient)}>
                  <PlanIcon className="w-4 h-4 text-white" />
                </div>
              );
            })()}
            <div>
              <p className="font-semibold text-sm">
                {isUpgrade ? "Upgrade to" : "Switch to"}{" "}
                <span className="text-primary">{selectedPlanData?.name} Plan</span>
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold">
                  {memberLimitLabel(selectedPlanData?.memberLimit ?? 0)}
                </span>
                {" · "}
                ${annual ? selectedPlanData?.yearlyPrice : selectedPlanData?.price}/mo
                {annual ? ` · $${((annual ? selectedPlanData?.yearlyPrice : selectedPlanData?.price) ?? 0) * 12}/year` : " · billed monthly"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => setSelectedPlan(null)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleUpgrade()} disabled={upgrading} className="flex-1 sm:flex-none gap-1.5">
              {upgrading ? "Redirecting…" : (
                <>{isUpgrade ? "Upgrade Now" : "Switch Plan"}<ArrowRight className="w-3.5 h-3.5" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
