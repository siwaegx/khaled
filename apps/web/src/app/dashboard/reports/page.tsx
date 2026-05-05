"use client";

import { useEffect, useState } from "react";
import { Users, Package, FileText, FolderKanban, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";

type Summary = {
  crm: { leads: number; customers: number; deals: number; dealValue: number };
  inventory: { products: number; warehouses: number; purchaseOrders: number };
  accounting: { invoices: number; paidRevenue: number; totalExpenses: number };
  hr: { activeEmployees: number; pendingLeave: number };
  projects: { activeProjects: number; openTasks: number };
};

type RevenueRow = { month: string; revenue: number; expenses: number; profit: number };

function BarChart({ rows }: { rows: RevenueRow[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.revenue, r.expenses]), 1);
  const pct = (v: number) => `${Math.round((v / max) * 100)}%`;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />Revenue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Expenses</span>
      </div>
      <div className="flex items-end gap-1.5 h-44 overflow-x-auto pb-1">
        {rows.map((row) => (
          <div key={row.month} className="flex flex-col items-center gap-0.5 shrink-0 flex-1" style={{ minWidth: "2.5rem" }}>
            <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: "8rem" }}>
              <div
                className="w-3.5 rounded-t bg-emerald-500 transition-all"
                style={{ height: pct(row.revenue) }}
                title={`Revenue: $${row.revenue.toLocaleString()}`}
              />
              <div
                className="w-3.5 rounded-t bg-red-400 transition-all"
                style={{ height: pct(row.expenses) }}
                title={`Expenses: $${row.expenses.toLocaleString()}`}
              />
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center">{row.month.slice(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={cn("w-4 h-4", color)} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{loading ? "—" : value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [summary, setSummary]   = useState<Summary | null>(null);
  const [revenue, setRevenue]   = useState<RevenueRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Summary>("/api/reports/summary"),
      apiGet<{ data: RevenueRow[] }>("/api/reports/revenue"),
    ])
      .then(([s, r]) => { setSummary(s); setRevenue(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const profit = summary
    ? summary.accounting.paidRevenue - summary.accounting.totalExpenses
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Business Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Paid Revenue"      value={`$${(summary?.accounting.paidRevenue ?? 0).toLocaleString()}`}    icon={DollarSign}    color="text-emerald-500" loading={loading} />
          <KpiCard label="Total Expenses"    value={`$${(summary?.accounting.totalExpenses ?? 0).toLocaleString()}`}  icon={TrendingDown}  color="text-red-500"     loading={loading} sub="All time" />
          <KpiCard label="Net Profit"        value={`$${profit.toLocaleString()}`}                                    icon={TrendingUp}    color={profit >= 0 ? "text-emerald-500" : "text-red-500"} loading={loading} />
          <KpiCard label="Pipeline Value"    value={`$${(summary?.crm.dealValue ?? 0).toLocaleString()}`}             icon={TrendingUp}    color="text-blue-500"    loading={loading} sub="Open deals" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Module Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard label="Leads"             value={summary?.crm.leads ?? 0}             icon={Users}        color="text-blue-500"    loading={loading} sub={`${summary?.crm.customers ?? 0} customers`} />
          <KpiCard label="Active Employees"  value={summary?.hr.activeEmployees ?? 0}    icon={Users}        color="text-violet-500"  loading={loading} sub={`${summary?.hr.pendingLeave ?? 0} leave pending`} />
          <KpiCard label="Products"          value={summary?.inventory.products ?? 0}    icon={Package}      color="text-amber-500"   loading={loading} sub={`${summary?.inventory.warehouses ?? 0} warehouses`} />
          <KpiCard label="Invoices"          value={summary?.accounting.invoices ?? 0}   icon={FileText}     color="text-emerald-500" loading={loading} />
          <KpiCard label="Active Projects"   value={summary?.projects.activeProjects ?? 0} icon={FolderKanban} color="text-blue-500"  loading={loading} sub={`${summary?.projects.openTasks ?? 0} open tasks`} />
          <KpiCard label="Purchase Orders"   value={summary?.inventory.purchaseOrders ?? 0} icon={Package}   color="text-slate-500"   loading={loading} />
        </div>
      </div>

      {/* Bar chart */}
      {!loading && revenue.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue vs Expenses Chart</h2>
          <Card>
            <CardContent className="pt-4">
              <BarChart rows={revenue.slice(-12)} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue vs Expenses table */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Monthly Revenue vs Expenses</h2>
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-40 animate-pulse bg-muted rounded-lg" />
            ) : revenue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No financial data yet — add paid invoices and expenses to see trends</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Month</th>
                      <th className="text-right py-2 pr-6 font-medium text-muted-foreground">Revenue</th>
                      <th className="text-right py-2 pr-6 font-medium text-muted-foreground">Expenses</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {revenue.slice(-12).map((row) => (
                      <tr key={row.month}>
                        <td className="py-2 pr-6 text-muted-foreground">{row.month}</td>
                        <td className="py-2 pr-6 text-right font-medium text-emerald-600">${row.revenue.toLocaleString()}</td>
                        <td className="py-2 pr-6 text-right font-medium text-red-600">${row.expenses.toLocaleString()}</td>
                        <td className={cn("py-2 text-right font-semibold", row.profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                          {row.profit >= 0 ? "+" : ""}${row.profit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td className="pt-2 pr-6">Total</td>
                      <td className="pt-2 pr-6 text-right text-emerald-600">
                        ${revenue.reduce((s, r) => s + r.revenue, 0).toLocaleString()}
                      </td>
                      <td className="pt-2 pr-6 text-right text-red-600">
                        ${revenue.reduce((s, r) => s + r.expenses, 0).toLocaleString()}
                      </td>
                      <td className={cn("pt-2 text-right", revenue.reduce((s, r) => s + r.profit, 0) >= 0 ? "text-emerald-700" : "text-red-700")}>
                        ${revenue.reduce((s, r) => s + r.profit, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
