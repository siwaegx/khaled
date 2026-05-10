"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users, Package, FileText, FolderKanban, TrendingUp, TrendingDown,
  DollarSign, Printer, AlertTriangle, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import { useCurrency, formatCurrency } from "@/lib/currency";

type Summary = {
  crm: { leads: number; customers: number; deals: number; dealValue: number };
  inventory: { products: number; warehouses: number; purchaseOrders: number };
  accounting: { invoices: number; paidRevenue: number; totalExpenses: number };
  hr: { activeEmployees: number; pendingLeave: number };
  projects: { activeProjects: number; openTasks: number };
};

type RevenueRow = { month: string; revenue: number; expenses: number; profit: number };

type Alert = {
  overdueInvoices: { id: string; number: string; customerName: string; dueDate: string; total: number }[];
  lowStock: { id: string; quantity: number; minQuantity: number; product: { id: string; name: string; sku: string }; warehouse: { id: string; name: string } }[];
};

function CurrencyTooltip({
  active, payload, label, currency,
}: {
  active?: boolean; payload?: { name: string; value: number; color: string }[];
  label?: string; currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border rounded-lg shadow-md px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value, currency)}
        </p>
      ))}
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, color, loading, href,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; loading: boolean; href?: string;
}) {
  const inner = (
    <Card className={cn("transition-colors", href && "hover:bg-muted/50 cursor-pointer")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={cn("w-4 h-4", color)} />
          {label}
          {href && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{loading ? "—" : value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

export default function ReportsPage() {
  const currency = useCurrency();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [alerts, setAlerts]   = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiGet<Summary>("/api/reports/summary"),
      apiGet<{ data: RevenueRow[] }>("/api/reports/revenue"),
      apiGet<Alert>("/api/reports/alerts"),
    ])
      .then(([s, r, a]) => { setSummary(s); setRevenue(r.data); setAlerts(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handlePrint = useCallback(() => window.print(), []);

  const profit = summary
    ? summary.accounting.paidRevenue - summary.accounting.totalExpenses
    : 0;

  const chartData = revenue.slice(-12).map((r) => ({
    ...r,
    month: r.month.slice(2), // "26-05" instead of "2026-05"
  }));

  const totalAlerts = (alerts?.overdueInvoices.length ?? 0) + (alerts?.lowStock.length ?? 0);

  return (
    <>
      {/* Print stylesheet — injected via style tag */}
      <style>{`
        @media print {
          nav, aside, header, [data-no-print] { display: none !important; }
          body { background: white !important; }
          .recharts-wrapper { page-break-inside: avoid; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-8 print:space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between" data-no-print>
          <h1 className="text-xl font-semibold">Reports</h1>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border hover:bg-muted transition-colors"
          >
            <Printer className="w-4 h-4" />
            Export PDF
          </button>
        </div>

        {/* Alerts banner */}
        {!loading && totalAlerts > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              {(alerts?.overdueInvoices.length ?? 0) > 0 && (
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {alerts!.overdueInvoices.length} overdue invoice{alerts!.overdueInvoices.length !== 1 ? "s" : ""}
                </p>
              )}
              {(alerts?.lowStock.length ?? 0) > 0 && (
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {alerts!.lowStock.length} low-stock item{alerts!.lowStock.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* KPI cards */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Business Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Paid Revenue"
              value={formatCurrency(summary?.accounting.paidRevenue ?? 0, currency)}
              icon={DollarSign} color="text-emerald-500" loading={loading}
              href="/dashboard/accounting"
            />
            <KpiCard
              label="Total Expenses"
              value={formatCurrency(summary?.accounting.totalExpenses ?? 0, currency)}
              icon={TrendingDown} color="text-red-500" loading={loading} sub="All time"
              href="/dashboard/accounting"
            />
            <KpiCard
              label="Net Profit"
              value={formatCurrency(profit, currency)}
              icon={TrendingUp} color={profit >= 0 ? "text-emerald-500" : "text-red-500"} loading={loading}
            />
            <KpiCard
              label="Pipeline Value"
              value={formatCurrency(summary?.crm.dealValue ?? 0, currency)}
              icon={TrendingUp} color="text-blue-500" loading={loading} sub="Open deals"
              href="/dashboard/crm"
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Module Summary</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard label="Leads"            value={summary?.crm.leads ?? 0}              icon={Users}        color="text-blue-500"    loading={loading} sub={`${summary?.crm.customers ?? 0} customers`}        href="/dashboard/crm" />
            <KpiCard label="Active Employees" value={summary?.hr.activeEmployees ?? 0}     icon={Users}        color="text-violet-500"  loading={loading} sub={`${summary?.hr.pendingLeave ?? 0} leave pending`}  href="/dashboard/hr" />
            <KpiCard label="Products"         value={summary?.inventory.products ?? 0}     icon={Package}      color="text-amber-500"   loading={loading} sub={`${summary?.inventory.warehouses ?? 0} warehouses`} href="/dashboard/inventory" />
            <KpiCard label="Invoices"         value={summary?.accounting.invoices ?? 0}    icon={FileText}     color="text-emerald-500" loading={loading}                                                           href="/dashboard/accounting" />
            <KpiCard label="Active Projects"  value={summary?.projects.activeProjects ?? 0} icon={FolderKanban} color="text-blue-500"   loading={loading} sub={`${summary?.projects.openTasks ?? 0} open tasks`}  href="/dashboard/projects" />
            <KpiCard label="Purchase Orders"  value={summary?.inventory.purchaseOrders ?? 0} icon={Package}    color="text-slate-500"   loading={loading}                                                           href="/dashboard/inventory" />
          </div>
        </div>

        {/* Recharts: Area chart — revenue vs expenses */}
        {!loading && chartData.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue vs Expenses (12 months)</h2>
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact" })} width={72} />
                    <Tooltip content={<CurrencyTooltip currency={currency} />} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f87171" fill="url(#colorExpenses)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recharts: Bar chart — monthly profit */}
        {!loading && chartData.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Monthly Profit</h2>
            <Card>
              <CardContent className="pt-6">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v, currency, { notation: "compact" })} width={72} />
                    <Tooltip content={<CurrencyTooltip currency={currency} />} />
                    <Bar
                      dataKey="profit"
                      name="Profit"
                      radius={[3, 3, 0, 0]}
                      fill="#6366f1"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Revenue vs Expenses table */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Monthly Breakdown</h2>
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
                        <tr key={row.month} className="hover:bg-muted/30">
                          <td className="py-2 pr-6 text-muted-foreground">{row.month}</td>
                          <td className="py-2 pr-6 text-right font-medium text-emerald-600">{formatCurrency(row.revenue, currency)}</td>
                          <td className="py-2 pr-6 text-right font-medium text-red-600">{formatCurrency(row.expenses, currency)}</td>
                          <td className={cn("py-2 text-right font-semibold", row.profit >= 0 ? "text-emerald-700" : "text-red-700")}>
                            {row.profit >= 0 ? "+" : ""}{formatCurrency(Math.abs(row.profit), currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td className="pt-2 pr-6">Total</td>
                        <td className="pt-2 pr-6 text-right text-emerald-600">
                          {formatCurrency(revenue.reduce((s, r) => s + r.revenue, 0), currency)}
                        </td>
                        <td className="pt-2 pr-6 text-right text-red-600">
                          {formatCurrency(revenue.reduce((s, r) => s + r.expenses, 0), currency)}
                        </td>
                        <td className={cn("pt-2 text-right", revenue.reduce((s, r) => s + r.profit, 0) >= 0 ? "text-emerald-700" : "text-red-700")}>
                          {formatCurrency(Math.abs(revenue.reduce((s, r) => s + r.profit, 0)), currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts detail: overdue invoices */}
        {!loading && (alerts?.overdueInvoices.length ?? 0) > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Overdue Invoices</h2>
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Invoice</th>
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Customer</th>
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Due Date</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {alerts!.overdueInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-muted/30">
                          <td className="py-2 pr-6">
                            <Link href="/dashboard/accounting" className="text-primary hover:underline">
                              {inv.number}
                            </Link>
                          </td>
                          <td className="py-2 pr-6">{inv.customerName}</td>
                          <td className="py-2 pr-6 text-red-600">{new Date(inv.dueDate).toLocaleDateString()}</td>
                          <td className="py-2 text-right font-medium">{formatCurrency(inv.total, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts detail: low stock */}
        {!loading && (alerts?.lowStock.length ?? 0) > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Low Stock Items</h2>
            <Card>
              <CardContent className="pt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Product</th>
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">SKU</th>
                        <th className="text-left py-2 pr-6 font-medium text-muted-foreground">Warehouse</th>
                        <th className="text-right py-2 pr-6 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right py-2 font-medium text-muted-foreground">Min</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {alerts!.lowStock.map((s) => (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="py-2 pr-6">
                            <Link href="/dashboard/inventory" className="text-primary hover:underline">
                              {s.product.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-6 text-muted-foreground font-mono text-xs">{s.product.sku}</td>
                          <td className="py-2 pr-6">{s.warehouse.name}</td>
                          <td className="py-2 pr-6 text-right font-medium text-amber-600">{s.quantity}</td>
                          <td className="py-2 text-right text-muted-foreground">{s.minQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
