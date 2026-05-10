"use client";

import { useEffect, useState } from "react";
import { Users, TrendingUp, HandshakeIcon, UserCheck, BookUser, Building2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import { useCurrency, formatCurrency } from "@/lib/currency";

type Stats = {
  totalLeads: number;
  totalCustomers: number;
  totalDeals: number;
  totalCompanies: number;
  totalContacts: number;
  leadsByStatus: { status: string; _count: { id: number } }[];
  dealsByStatus: { status: string; _count: { id: number }; _sum: { value: number | null } }[];
};

const DEAL_STATUS_COLOR: Record<string, string> = {
  prospect:    "bg-slate-100 text-slate-700",
  qualified:   "bg-blue-100 text-blue-700",
  proposal:    "bg-violet-100 text-violet-700",
  negotiation: "bg-amber-100 text-amber-700",
  won:         "bg-emerald-100 text-emerald-700",
  lost:        "bg-red-100 text-red-700",
};

export default function CrmOverviewPage() {
  const currency = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Stats>("/api/crm/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const totalPipelineValue = stats?.dealsByStatus
    .filter((d) => !["won", "lost"].includes(d.status))
    .reduce((sum, d) => sum + (d._sum.value ?? 0), 0) ?? 0;

  const wonValue = stats?.dealsByStatus
    .find((d) => d.status === "won")?._sum.value ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads",  value: stats?.totalLeads,     icon: Users,         color: "text-blue-500" },
          { label: "Customers",    value: stats?.totalCustomers, icon: UserCheck,     color: "text-emerald-500" },
          { label: "Active Deals", value: stats?.totalDeals,     icon: TrendingUp,    color: "text-violet-500" },
          { label: "Won Revenue",  value: formatCurrency(wonValue ?? 0, currency), icon: HandshakeIcon, color: "text-amber-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Icon className={cn("w-4 h-4", color)} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {loading ? "—" : (value ?? 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Leads by Status</CardTitle>
              <Link href="/dashboard/crm/leads" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : stats?.leadsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No leads yet</p>
            ) : (
              (stats?.leadsByStatus ?? []).map((l) => (
                <div key={l.status} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-muted-foreground">{l.status}</span>
                  <Badge variant="secondary" className="font-mono">{l._count.id}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Deals pipeline */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Pipeline Value
                {totalPipelineValue > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {formatCurrency(totalPipelineValue, currency)} total
                  </span>
                )}
              </CardTitle>
              <Link href="/dashboard/crm/deals" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View board <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : stats?.dealsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No deals yet</p>
            ) : (
              (stats?.dealsByStatus ?? []).map((d) => (
                <div key={d.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", DEAL_STATUS_COLOR[d.status] ?? "bg-muted")}>{d.status}</span>
                    <span className="text-muted-foreground">{d._count.id} deal{d._count.id !== 1 ? "s" : ""}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(d._sum.value ?? 0, currency)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contacts module summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Contacts</CardTitle>
            <Link href="/dashboard/contacts" className="text-xs text-primary flex items-center gap-1 hover:underline">
              Open Contacts <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-primary/10">
                <Building2 className="w-4 h-4 text-primary" />
              </span>
              <div>
                <p className="text-2xl font-bold">{loading ? "—" : (stats?.totalCompanies ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Companies</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-violet-50">
                <BookUser className="w-4 h-4 text-violet-600" />
              </span>
              <div>
                <p className="text-2xl font-bold">{loading ? "—" : (stats?.totalContacts ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Contacts</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
