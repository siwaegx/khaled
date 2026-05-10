"use client";

import { useEffect, useState } from "react";
import { FileText, Receipt, DollarSign, AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import { useCurrency, formatCurrency } from "@/lib/currency";

type Stats = {
  totalInvoices:       number;
  totalExpenses:       number;
  paidTotal:           number;
  outstandingTotal:    number;
  invoicesByStatus:    { status: string; _count: { id: number }; _sum: { total: number | null } }[];
  expensesByCategory:  { category: string; _count: { id: number }; _sum: { amount: number | null } }[];
};

const INV_STATUS_COLOR: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  sent:      "bg-blue-100 text-blue-700",
  paid:      "bg-emerald-100 text-emerald-700",
  overdue:   "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default function AccountingOverviewPage() {
  const currency = useCurrency();
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Stats>("/api/accounting/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices",  value: stats?.totalInvoices,                                icon: FileText,    color: "text-blue-500"    },
          { label: "Paid Revenue",    value: stats ? formatCurrency(stats.paidTotal, currency) : formatCurrency(0, currency), icon: DollarSign,  color: "text-emerald-500" },
          { label: "Outstanding",     value: stats ? formatCurrency(stats.outstandingTotal, currency) : formatCurrency(0, currency), icon: AlertCircle, color: "text-amber-500"  },
          { label: "Total Expenses",  value: stats?.totalExpenses,                                icon: Receipt,     color: "text-red-500"     },
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
                {loading ? "—" : (typeof value === "number" ? value.toLocaleString() : value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Invoices by Status</CardTitle>
              <Link href="/dashboard/accounting/invoices" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : (stats?.invoicesByStatus.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>
            ) : (
              (stats?.invoicesByStatus ?? []).map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", INV_STATUS_COLOR[s.status] ?? "bg-muted")}>{s.status}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">{s._count.id}</Badge>
                    <span className="text-muted-foreground text-xs">{formatCurrency(s._sum.total ?? 0, currency)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Top Expense Categories</CardTitle>
              <Link href="/dashboard/accounting/expenses" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : (stats?.expensesByCategory.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No expenses yet</p>
            ) : (
              (stats?.expensesByCategory ?? []).slice(0, 5).map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{c.category}</span>
                  <span className="font-medium">{formatCurrency(c._sum.amount ?? 0, currency)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
