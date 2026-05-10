"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Users, DollarSign, Activity, RefreshCw,
  AlertTriangle, Clock, Package, TrendingDown, ArrowUpRight, ArrowDownRight,
  CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import Link from "next/link";

type Stats = {
  totalOrgs: number; totalUsers: number;
  orgsByPlan: { plan: string; _count: { id: number } }[];
  orgsByStatus: { status: string; _count: { id: number } }[];
  newOrgsWeek: number; newUsersWeek: number;
};
type PlanRow = { plan: string; count: number; pricePerMonth: number; mrr: number; delta: number };
type Alert = {
  trialsExpiring: { id: string; name: string; plan: string; trialEnds: string; _count: { members: number } }[];
  pendingSubmissions: number;
  newOrgsWeek: number; newUsersWeek: number;
  recentCancellations: { id: string; name: string; plan: string; updatedAt: string }[];
};

const STATUS_STYLE: Record<string, string> = {
  trial:     "border-amber-500/30 bg-amber-500/10 text-amber-400",
  active:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  suspended: "border-red-500/30 bg-red-500/10 text-red-400",
  cancelled: "border-slate-700 bg-slate-800 text-slate-500",
};
const PLAN_STYLE: Record<string, string> = {
  starter:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  growth:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  pro:        "border-violet-500/30 bg-violet-500/10 text-violet-400",
  enterprise: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function KpiCard({ label, value, sub, icon: Icon, color, loading }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
            <p className={cn("text-2xl font-bold", color)}>
              {loading ? <span className="inline-block w-12 h-7 bg-slate-800 animate-pulse rounded" /> : value}
            </p>
            {sub && !loading && <p className="text-[11px] text-slate-600 mt-1">{sub}</p>}
          </div>
          <div className={cn("p-2 rounded-lg", color.replace("text-", "bg-").replace("400", "500/10"))}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SAdminOverview() {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [plans, setPlans]     = useState<PlanRow[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const [alerts, setAlerts]   = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, a] = await Promise.all([
        apiGet<Stats>("/api/sadmin/stats"),
        apiGet<{ plans: PlanRow[]; totalMrr: number }>("/api/sadmin/plans"),
        apiGet<Alert>("/api/sadmin/alerts"),
      ]);
      setStats(s); setPlans(p.plans); setTotalMrr(p.totalMrr); setAlerts(a);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hasAttention = alerts && (
    alerts.trialsExpiring.length > 0 ||
    alerts.pendingSubmissions > 0 ||
    alerts.recentCancellations.length > 0
  );

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Platform Overview</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Business360 SaaS platform control center</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}
          className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Organizations" value={stats?.totalOrgs ?? 0}
          sub={alerts ? `+${alerts.newOrgsWeek} this week` : undefined}
          icon={Building2} color="text-cyan-400" loading={loading} />
        <KpiCard label="Users" value={stats?.totalUsers ?? 0}
          sub={alerts ? `+${alerts.newUsersWeek} this week` : undefined}
          icon={Users} color="text-violet-400" loading={loading} />
        <KpiCard label="Est. MRR" value={`$${totalMrr.toLocaleString()}`}
          sub={plans.length > 0 ? `across ${plans.reduce((s, p) => s + p.count, 0)} paying orgs` : undefined}
          icon={DollarSign} color="text-amber-400" loading={loading} />
        <KpiCard label="Active Plans" value={plans.reduce((s, p) => s + p.count, 0)}
          sub="active + trial"
          icon={Activity} color="text-emerald-400" loading={loading} />
      </div>

      {/* Needs Attention */}
      {!loading && hasAttention && (
        <Card className="bg-slate-900/60 border-amber-500/20">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-[13px] font-semibold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Expiring trials */}
            {alerts!.trialsExpiring.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Trials expiring within 7 days ({alerts!.trialsExpiring.length})
                </p>
                <div className="space-y-1.5">
                  {alerts!.trialsExpiring.map((org) => {
                    const days = daysUntil(org.trialEnds);
                    return (
                      <Link key={org.id} href={`/sadmin/orgs/${org.id}`}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 transition-colors group">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[12px] font-medium text-slate-200 group-hover:text-white">{org.name}</span>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", PLAN_STYLE[org.plan] ?? "")}>
                            {org.plan}
                          </Badge>
                        </div>
                        <span className={cn("text-[11px] font-semibold", days <= 2 ? "text-red-400" : "text-amber-400")}>
                          {days <= 0 ? "Expired" : days === 1 ? "1 day left" : `${days} days left`}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending submissions */}
            {alerts!.pendingSubmissions > 0 && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-blue-400" />
                  <span className="text-[12px] font-medium text-slate-200">
                    {alerts!.pendingSubmissions} module submission{alerts!.pendingSubmissions !== 1 ? "s" : ""} awaiting review
                  </span>
                </div>
                <Link href="/sadmin/submissions"
                  className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                  Review now →
                </Link>
              </div>
            )}

            {/* Recent cancellations */}
            {alerts!.recentCancellations.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  Cancelled this week ({alerts!.recentCancellations.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {alerts!.recentCancellations.map((org) => (
                    <Link key={org.id} href={`/sadmin/orgs/${org.id}`}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/5 border border-red-500/15 hover:bg-red-500/10 transition-colors">
                      <XCircle className="w-3 h-3 text-red-400" />
                      <span className="text-[11px] text-slate-300">{org.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All clear */}
      {!loading && !hasAttention && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[12px] text-emerald-400 font-medium">All systems healthy — no immediate actions required</span>
        </div>
      )}

      {/* Plan + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-semibold text-slate-300">Plan Distribution</CardTitle>
              <Link href="/sadmin/plans" className="text-[11px] text-cyan-400 hover:underline">View details →</Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {loading ? <div className="h-24 animate-pulse bg-slate-800 rounded-lg" /> :
              plans.length === 0
                ? <p className="text-[12px] text-slate-600 py-4 text-center">No active subscriptions</p>
                : <div className="space-y-2.5">
                  {plans.slice().sort((a, b) => b.mrr - a.mrr).map((p) => (
                    <div key={p.plan} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Badge variant="outline" className={cn("text-[11px] capitalize", PLAN_STYLE[p.plan] ?? "")}>
                          {p.plan}
                        </Badge>
                        <span className="text-[12px] text-slate-500">{p.count} org{p.count !== 1 ? "s" : ""}</span>
                        {p.delta !== 0 && (
                          <span className={cn("text-[10px] flex items-center gap-0.5 font-medium",
                            p.delta > 0 ? "text-emerald-400" : "text-red-400")}>
                            {p.delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {Math.abs(p.delta)}
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] font-semibold text-slate-300">${p.mrr.toLocaleString()}/mo</span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-slate-800 flex justify-between">
                    <span className="text-[11px] text-slate-500">Total MRR</span>
                    <span className="text-[12px] font-bold text-amber-400">${totalMrr.toLocaleString()}/mo</span>
                  </div>
                </div>
            }
          </CardContent>
        </Card>

        <Card className="bg-slate-900/60 border-slate-800">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[13px] font-semibold text-slate-300">Org Status</CardTitle>
              <Link href="/sadmin/subscriptions" className="text-[11px] text-cyan-400 hover:underline">Manage →</Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {loading ? <div className="h-24 animate-pulse bg-slate-800 rounded-lg" /> :
              (stats?.orgsByStatus ?? []).map((row) => {
                const total = stats!.totalOrgs || 1;
                const pct   = Math.round((row._count.id / total) * 100);
                return (
                  <div key={row.status} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={cn("text-[11px] capitalize", STATUS_STYLE[row.status] ?? "")}>
                        {row.status}
                      </Badge>
                      <span className="text-[12px] font-semibold text-slate-300">{row._count.id}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full",
                        row.status === "active" ? "bg-emerald-500" :
                        row.status === "trial"  ? "bg-amber-500" :
                        row.status === "suspended" ? "bg-red-500" : "bg-slate-600"
                      )} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            }
          </CardContent>
        </Card>
      </div>

      {/* Quick access */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { href: "/sadmin/subscriptions", label: "Subscriptions", color: "text-cyan-400",    border: "hover:border-cyan-500/30" },
          { href: "/sadmin/plans",         label: "Plans & MRR",   color: "text-emerald-400", border: "hover:border-emerald-500/30" },
          { href: "/sadmin/users",         label: "Users",         color: "text-violet-400",  border: "hover:border-violet-500/30" },
          { href: "/sadmin/orgs",          label: "Organizations", color: "text-amber-400",   border: "hover:border-amber-500/30" },
          { href: "/sadmin/submissions",   label: "Submissions",   color: "text-blue-400",    border: "hover:border-blue-500/30" },
        ].map(({ href, label, color, border }) => (
          <Link key={href} href={href}
            className={cn("flex items-center justify-center py-4 rounded-xl border border-slate-800 bg-slate-800/20 hover:bg-slate-800/60 transition-all group text-center", border)}>
            <span className={cn("text-[12px] font-semibold group-hover:underline", color)}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
