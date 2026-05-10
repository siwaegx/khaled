"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Minus, Settings2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";

type PlanRow = { plan: string; count: number; pricePerMonth: number; mrr: number; delta: number };

const PLAN_STYLE: Record<string, string> = {
  starter:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  growth:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  pro:        "border-violet-500/30 bg-violet-500/10 text-violet-400",
  enterprise: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};
const PLAN_BAR: Record<string, string> = {
  starter: "bg-emerald-500", growth: "bg-blue-500", pro: "bg-violet-500", enterprise: "bg-amber-500",
};
const PLAN_ORDER = ["starter", "growth", "pro", "enterprise"];

export default function PlansPage() {
  const [plans, setPlans]       = useState<PlanRow[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ plans: PlanRow[]; totalMrr: number }>("/api/sadmin/plans");
      const sorted = [...res.plans].sort((a, b) => PLAN_ORDER.indexOf(a.plan) - PLAN_ORDER.indexOf(b.plan));
      setPlans(sorted);
      setTotalMrr(res.totalMrr);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalOrgs = plans.reduce((s, p) => s + p.count, 0);
  const maxMrr    = Math.max(...plans.map((p) => p.mrr), 1);
  const arpu      = totalOrgs > 0 ? Math.round(totalMrr / totalOrgs) : 0;

  function DeltaBadge({ delta }: { delta: number }) {
    if (delta === 0) return <span className="text-[10px] text-slate-600 flex items-center"><Minus className="w-3 h-3" />0</span>;
    return (
      <span className={cn("text-[10px] flex items-center gap-0.5 font-semibold",
        delta > 0 ? "text-emerald-400" : "text-red-400")}>
        {delta > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {Math.abs(delta)} vs last month
      </span>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Plans & MRR</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Monthly recurring revenue by subscription tier</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sadmin/plans/config"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white")}
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
            Configure
          </Link>
          <Button variant="outline" size="sm" onClick={() => void load()}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white">
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Est. MRR", value: loading ? null : `$${totalMrr.toLocaleString()}`, sub: "active + trial orgs", icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Active Orgs", value: loading ? null : totalOrgs, sub: "paying or trialing", icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { label: "ARPU", value: loading ? null : totalOrgs === 0 ? "—" : `$${arpu}`, sub: "avg revenue per org/mo", icon: DollarSign, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label} className="bg-slate-900/60 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
                  {value === null
                    ? <div className="h-7 w-20 bg-slate-800 animate-pulse rounded" />
                    : <p className={cn("text-2xl font-bold", color)}>{value}</p>
                  }
                  <p className="text-[11px] text-slate-600 mt-1">{sub}</p>
                </div>
                <div className={cn("p-2 rounded-lg", bg)}>
                  <Icon className={cn("w-4 h-4", color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Visual breakdown */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300">Revenue by Plan</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-800 animate-pulse rounded-lg" />)}
            </div>
          ) : plans.length === 0 ? (
            <p className="text-[12px] text-slate-600 text-center py-8">No active subscriptions</p>
          ) : (
            <div className="space-y-5">
              {plans.slice().sort((a, b) => b.mrr - a.mrr).map((p) => (
                <div key={p.plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <Badge variant="outline" className={cn("text-[11px] capitalize", PLAN_STYLE[p.plan] ?? "")}>
                        {p.plan}
                      </Badge>
                      <span className="text-[12px] text-slate-500">
                        {p.count} org{p.count !== 1 ? "s" : ""} × ${p.pricePerMonth}/mo
                      </span>
                      <DeltaBadge delta={p.delta} />
                    </div>
                    <span className="text-[13px] font-semibold text-slate-200">
                      ${p.mrr.toLocaleString()}/mo
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", PLAN_BAR[p.plan] ?? "bg-slate-500")}
                      style={{ width: `${(p.mrr / maxMrr) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300">Plan Summary</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Plan", "Price/mo", "Active Orgs", "vs Last Month", "MRR", "% of Total"].map((h) => (
                    <th key={h} className="text-left text-[11px] text-slate-500 font-medium pb-3 uppercase tracking-wider last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-[12px] text-slate-600">Loading…</td></tr>
                ) : plans.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-[12px] text-slate-600">No data</td></tr>
                ) : plans.map((p) => (
                  <tr key={p.plan}>
                    <td className="py-3">
                      <Badge variant="outline" className={cn("text-[11px] capitalize", PLAN_STYLE[p.plan] ?? "")}>
                        {p.plan}
                      </Badge>
                    </td>
                    <td className="py-3 text-[12px] text-slate-300 tabular-nums">${p.pricePerMonth}</td>
                    <td className="py-3 text-[12px] text-slate-400 tabular-nums">{p.count}</td>
                    <td className="py-3"><DeltaBadge delta={p.delta} /></td>
                    <td className="py-3 text-[12px] text-slate-200 font-semibold tabular-nums">${p.mrr.toLocaleString()}</td>
                    <td className="py-3 text-[12px] text-slate-500 tabular-nums text-right">
                      {totalMrr > 0 ? `${Math.round((p.mrr / totalMrr) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && plans.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-700">
                    <td colSpan={2} className="pt-3 text-[11px] text-slate-500 font-semibold uppercase">Total</td>
                    <td className="pt-3 text-[12px] text-slate-300 font-semibold tabular-nums">{totalOrgs}</td>
                    <td />
                    <td className="pt-3 text-[13px] text-amber-400 font-bold tabular-nums">${totalMrr.toLocaleString()}</td>
                    <td className="pt-3 text-[12px] text-slate-500 text-right">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
