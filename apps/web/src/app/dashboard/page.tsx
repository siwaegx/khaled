"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Users, Boxes, Calculator, UserCheck,
  Package, BarChart3, CheckCircle2, Lock, Clock,
  TrendingUp, TrendingDown, FileText, Briefcase, UserCog,
  CreditCard, Layers, Activity, ArrowRight, SlidersHorizontal, X, GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPut } from "@/lib/api";
import { useCurrency, formatCurrency } from "@/lib/currency";

/* ─── Module registry ──────────────────────────────────── */

const ALL_MODULES = [
  { key: "crm",        href: "/dashboard/crm",        icon: Users,      label: "CRM",        desc: "Leads · Deals · Customers",       plan: "Starter",    bg: "bg-blue-500",    faded: "bg-blue-50 text-blue-600" },
  { key: "inventory",  href: "/dashboard/inventory",  icon: Boxes,      label: "Inventory",  desc: "Stock · Warehouses · Transfers",  plan: "Growth",     bg: "bg-teal-500",    faded: "bg-teal-50 text-teal-600" },
  { key: "accounting", href: "/dashboard/accounting", icon: Calculator, label: "Accounting", desc: "Invoices · Expenses · Reports",   plan: "Pro",        bg: "bg-violet-500",  faded: "bg-violet-50 text-violet-600" },
  { key: "hr",         href: "/dashboard/hr",         icon: UserCheck,  label: "HR",         desc: "Employees · Leave · Contracts",   plan: "Pro",        bg: "bg-orange-500",  faded: "bg-orange-50 text-orange-600" },
  { key: "projects",   href: "/dashboard/projects",   icon: Package,    label: "Projects",   desc: "Tasks · Milestones · Teams",      plan: "Enterprise", bg: "bg-rose-500",    faded: "bg-rose-50 text-rose-600" },
  { key: "reports",    href: "/dashboard/reports",    icon: BarChart3,  label: "Reports",    desc: "KPIs · Dashboards · Exports",     plan: "Enterprise", bg: "bg-amber-500",   faded: "bg-amber-50 text-amber-600" },
];

const PLAN_BADGE: Record<string, string> = {
  starter:    "bg-blue-50 border-blue-200 text-blue-700",
  growth:     "bg-teal-50 border-teal-200 text-teal-700",
  pro:        "bg-violet-50 border-violet-200 text-violet-700",
  enterprise: "bg-amber-50 border-amber-200 text-amber-700",
};

/* ─── Types ─────────────────────────────────────────────── */

type Summary = {
  crm?:        { leads: number; customers: number; deals: number; openDeals: number };
  inventory?:  { products: number; warehouses: number; orders: number };
  accounting?: { paidRevenue: number; pendingRevenue: number; expenses: number; currency: string };
  hr?:         { employees: number; activeEmployees: number; pendingLeave: number };
  projects?:   { projects: number; activeProjects: number; tasks: number; openTasks: number };
};

/* ─── Count-up hook (skill: KPI value animations) ──────── */

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (target === 0 || started.current) return;
    started.current = true;
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min((Date.now() - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);
  return val;
}

/* ─── Sub-components ────────────────────────────────────── */

// Skill: Executive Dashboard — large KPI cards (--kpi-font-size: 48px), trend indicators
function KpiCard({
  label, value, rawValue, icon: Icon, iconBg, accent, sub, badge, trend,
}: {
  label: string;
  value?: string;
  rawValue?: number;
  icon: React.ElementType;
  iconBg: string;
  accent: string;
  sub?: string;
  badge?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}) {
  const counted = useCountUp(rawValue ?? 0);
  const display = value ?? counted;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 relative overflow-hidden card-hover">
      <div className={cn("absolute inset-y-0 left-0 w-1 rounded-r-full", accent)} />
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-widest">{label}</p>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconBg)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {/* Skill spec: --kpi-font-size: 48px */}
      <p className="text-[2.75rem] font-extrabold leading-none tracking-tight tabular-nums" style={{ fontFamily: "var(--font-poppins, sans-serif)" }}>
        {display}
      </p>
      <div className="mt-3 flex items-center gap-1.5">
        {trend === "up"   && <TrendingUp   className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        {trend === "down" && <TrendingDown  className="w-3.5 h-3.5 text-rose-500    shrink-0" />}
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {badge}
      </div>
    </div>
  );
}

// Skill: Data-Dense Dashboard — compact live metric cards, minimal padding
function LiveCard({ label, value, icon: Icon, sub, trend }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  sub?: string;
  trend?: "up" | "down";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 relative overflow-hidden card-hover group cursor-pointer">
      <div className="absolute inset-y-0 left-0 w-0.5 bg-primary/50 rounded-r-full group-hover:bg-primary transition-colors" />
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-widest truncate">{label}</p>
        <div className="flex items-center gap-1">
          {trend === "up"   && <TrendingUp   className="w-3 h-3 text-emerald-500" />}
          {trend === "down" && <TrendingDown  className="w-3 h-3 text-rose-500" />}
          <Icon className="w-3 h-3 text-muted-foreground/40" />
        </div>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// Skill: loading-states — animate-pulse skeleton for async data
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/30 p-4 animate-pulse">
      <div className="h-2.5 w-16 bg-muted rounded mb-3" />
      <div className="h-7 w-20 bg-muted rounded mb-2" />
      <div className="h-2 w-24 bg-muted rounded" />
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────── */

type WidgetConfig = { key: string; visible: boolean; order: number };

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { key: "kpi-cards",   visible: true, order: 0 },
  { key: "live-stats",  visible: true, order: 1 },
  { key: "modules",     visible: true, order: 2 },
];

const WIDGET_LABELS: Record<string, string> = {
  "kpi-cards":  "KPI Cards (Plan, Modules, Status)",
  "live-stats": "Live Overview",
  "modules":    "Module Grid",
};

function useDashboardConfig() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiGet<{ config: { widgets: WidgetConfig[] } | null }>("/api/dashboard/config")
      .then((r) => {
        if (r.config?.widgets?.length) setWidgets(r.config.widgets);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (next: WidgetConfig[]) => {
    setWidgets(next);
    await apiPut("/api/dashboard/config", { widgets: next }).catch(() => {});
  }, []);

  return { widgets: loaded ? widgets : DEFAULT_WIDGETS, save };
}

export default function DashboardPage() {
  const { user, org } = useAuth();
  const currency = useCurrency();
  const [now] = useState(() => Date.now());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const { widgets, save: saveWidgets } = useDashboardConfig();

  const installedKeys = new Set(org?.modules.map((m) => m.moduleKey) ?? []);
  const activeCount = installedKeys.size;

  const trialDaysLeft = org?.status === "trial"
    ? Math.max(0, Math.ceil((new Date(org.trialEnds).getTime() - now) / 86_400_000))
    : null;

  useEffect(() => {
    if (activeCount === 0) return;
    setLoadingSummary(true);
    apiGet<Summary>("/api/reports/summary")
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
  }, [activeCount]);

  const liveStats: { label: string; value: string | number; icon: React.ElementType; sub?: string; trend?: "up" | "down" }[] = [];

  if (summary?.crm && installedKeys.has("crm")) {
    liveStats.push({ label: "Open Deals",  value: summary.crm.openDeals,   icon: TrendingUp, sub: `${summary.crm.deals} total`,       trend: "up" });
    liveStats.push({ label: "Customers",   value: summary.crm.customers,   icon: Users,      sub: `${summary.crm.leads} leads` });
  }
  if (summary?.accounting && installedKeys.has("accounting")) {
    liveStats.push({ label: "Revenue",     value: formatCurrency(summary.accounting.paidRevenue ?? 0, currency),    icon: Calculator, sub: `${formatCurrency(summary.accounting.pendingRevenue ?? 0, currency)} pending`, trend: "up" });
  }
  if (summary?.hr && installedKeys.has("hr")) {
    liveStats.push({ label: "Employees",   value: summary.hr.activeEmployees, icon: UserCog,  sub: `${summary.hr.pendingLeave} pending leave` });
  }
  if (summary?.projects && installedKeys.has("projects")) {
    liveStats.push({ label: "Open Tasks",  value: summary.projects.openTasks, icon: Briefcase, sub: `${summary.projects.activeProjects} active projects` });
  }
  if (summary?.inventory && installedKeys.has("inventory")) {
    liveStats.push({ label: "Products",    value: summary.inventory.products, icon: Boxes,    sub: `${summary.inventory.orders} orders` });
  }
  if (!summary && !loadingSummary && installedKeys.has("reports")) {
    liveStats.push({ label: "Reports", value: "—", icon: FileText });
  }

  const orgPlan = org?.plan?.toLowerCase() ?? "";
  const planBadgeClass = PLAN_BADGE[orgPlan] ?? "bg-muted border-border text-muted-foreground";
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-10">

      {/* ── Welcome ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Welcome back, <span className="text-gradient">{firstName}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2 flex-wrap">
            <span>{org?.name}</span>
            {org?.plan && (
              <span className={cn("inline-flex items-center text-xs font-semibold border rounded-full px-2 py-0.5 capitalize", planBadgeClass)}>
                {org.plan}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={() => setShowCustomize(true)}
            className="hidden sm:flex items-center gap-1.5 text-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Customize
          </Button>
          <Link
            href="/dashboard/store"
            className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-cta text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-cta-sm cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" /> Add Modules
          </Link>
        </div>
      </div>

      {/* ── Customize modal ──────────────────────────────── */}
      {showCustomize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCustomize(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">Customize Dashboard</h2>
              <button onClick={() => setShowCustomize(false)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Toggle which sections appear on your dashboard.</p>
            <div className="space-y-2">
              {[...widgets].sort((a, b) => a.order - b.order).map((w) => (
                <div key={w.key} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1 text-sm font-medium">{WIDGET_LABELS[w.key] ?? w.key}</span>
                  <button
                    onClick={() => {
                      const next = widgets.map((x) => x.key === w.key ? { ...x, visible: !x.visible } : x);
                      void saveWidgets(next);
                    }}
                    className={cn("w-10 h-5 rounded-full border-2 relative transition-all", w.visible ? "bg-primary border-primary" : "bg-muted border-border")}
                  >
                    <span className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all", w.visible ? "left-5" : "left-0.5")} />
                  </button>
                </div>
              ))}
            </div>
            <Button className="w-full mt-4" size="sm" onClick={() => setShowCustomize(false)}>Done</Button>
          </div>
        </div>
      )}

      {/* ── Trial banner ─────────────────────────────────── */}
      {trialDaysLeft !== null && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 text-sm text-amber-800">
          <Clock className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold">
              {trialDaysLeft === 0 ? "Trial ends today." : `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left in your trial.`}
            </span>
            {" "}Upgrade to keep full access.
          </div>
          <Link href="/dashboard/billing" className="text-xs font-semibold text-amber-700 underline underline-offset-4 shrink-0 cursor-pointer">
            Upgrade
          </Link>
        </div>
      )}

      {/* ── KPI Cards — Skill: Executive Dashboard, large numbers ── */}
      {widgets.find((w) => w.key === "kpi-cards")?.visible !== false && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Current Plan"
          value={org?.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : "—"}
          icon={CreditCard}
          iconBg="bg-primary/10 text-primary"
          accent="bg-gradient-brand"
          sub={org?.status === "trial" ? "Free Trial active" : "Active subscription"}
          badge={
            <Badge variant="outline" className={cn("text-[10px] capitalize h-4 px-1.5",
              org?.status === "trial"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            )}>
              {org?.status === "trial" ? "Trial" : (org?.status ?? "—")}
            </Badge>
          }
        />

        <KpiCard
          label="Active Modules"
          rawValue={activeCount}
          icon={Layers}
          iconBg="bg-violet-50 text-violet-600"
          accent="bg-gradient-to-b from-violet-400 to-violet-600"
          sub={`of ${ALL_MODULES.length} available`}
          badge={
            <div className="flex gap-0.5 ml-1">
              {ALL_MODULES.map((m) => (
                <span
                  key={m.key}
                  className={cn("w-1.5 h-1.5 rounded-full transition-all", installedKeys.has(m.key) ? m.bg : "bg-muted")}
                />
              ))}
            </div>
          }
        />

        <KpiCard
          label="System Status"
          value="Online"
          icon={Activity}
          iconBg="bg-emerald-50 text-emerald-600"
          accent="bg-gradient-to-b from-emerald-400 to-emerald-600"
          trend="up"
          sub={`${org?.userCount ?? 1} user seat${(org?.userCount ?? 1) !== 1 ? "s" : ""}`}
          badge={
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {/* Skill: --status-green: #22C55E */}
              All systems go
            </span>
          }
        />
      </div>
      )}

      {/* ── Live Overview — Skill: Data-Dense, compact KPI cards ── */}
      {widgets.find((w) => w.key === "live-stats")?.visible !== false && (loadingSummary || liveStats.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-widest">Live Overview</h2>
            <Link href="/dashboard/reports" className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer">
              Full report <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {loadingSummary
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : liveStats.map((s) => <LiveCard key={s.label} {...s} />)
            }
          </div>
        </div>
      )}

      {/* ── Module Grid — Skill: hover states, cursor-pointer, status colors ── */}
      {widgets.find((w) => w.key === "modules")?.visible !== false && (<div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-bold text-muted-foreground/55 uppercase tracking-widest">Your Modules</h2>
          <Link href="/dashboard/modules" className="text-xs text-primary font-medium hover:underline flex items-center gap-1 cursor-pointer">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_MODULES.map(({ key, href, icon: Icon, label, desc, plan, bg, faded }) => {
            const active = installedKeys.has(key);
            const inner = (
              <>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200",
                  active ? cn(bg, "text-white group-hover:scale-105") : "bg-muted text-muted-foreground/35"
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className={cn("text-sm font-semibold leading-tight", !active && "text-muted-foreground/45")}>{label}</p>
                    {active ? (
                      <span className="flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      </span>
                    ) : (
                      <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", faded.replace("bg-", "bg-").replace("text-", "border-").replace("50", "100/60"))}>
                        <Lock className="w-2.5 h-2.5 text-muted-foreground/40" />
                        <span className="text-muted-foreground/40">{plan}+</span>
                      </span>
                    )}
                  </div>
                  <p className={cn("text-xs leading-relaxed", active ? "text-muted-foreground" : "text-muted-foreground/30")}>{desc}</p>
                </div>
                {active && (
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1 group-hover:translate-x-0 transition-transform duration-200" />
                )}
              </>
            );
            const cls = cn(
              "rounded-2xl border p-4 flex items-start gap-3.5 transition-all duration-200",
              active
                ? "bg-card border-border/60 hover:border-primary/40 hover:shadow-md card-hover cursor-pointer group"
                : "bg-muted/20 border-border/40 cursor-not-allowed"
            );
            return active ? (
              <Link key={key} href={href} className={cls}>{inner}</Link>
            ) : (
              <div key={key} className={cls}>{inner}</div>
            );
          })}
        </div>
      </div>)}
    </div>
  );
}
