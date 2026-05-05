"use client";

import { useEffect, useState } from "react";
import { Package, Warehouse, ShoppingCart, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";

type Stats = {
  totalProducts:    number;
  totalWarehouses:  number;
  totalOrders:      number;
  productsByStatus: { status: string; _count: { id: number } }[];
};

const STATUS_COLOR: Record<string, string> = {
  active:       "bg-emerald-100 text-emerald-700",
  inactive:     "bg-slate-100 text-slate-700",
  discontinued: "bg-red-100 text-red-700",
};

export default function InventoryOverviewPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Stats>("/api/inventory/stats")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Products",   value: stats?.totalProducts,   icon: Package,      color: "text-blue-500"    },
          { label: "Warehouses", value: stats?.totalWarehouses, icon: Warehouse,    color: "text-violet-500"  },
          { label: "PO Orders",  value: stats?.totalOrders,     icon: ShoppingCart, color: "text-amber-500"   },
          { label: "Low Stock",  value: "—",                    icon: AlertTriangle,color: "text-red-500"     },
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
              <CardTitle className="text-sm font-semibold">Products by Status</CardTitle>
              <Link href="/dashboard/inventory/products" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-20 animate-pulse bg-muted rounded-lg" />
            ) : (stats?.productsByStatus.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No products yet</p>
            ) : (
              (stats?.productsByStatus ?? []).map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[s.status] ?? "bg-muted")}>
                    {s.status}
                  </span>
                  <Badge variant="secondary" className="font-mono">{s._count.id}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Quick Links</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { href: "/dashboard/inventory/products",   label: "Manage Products",   desc: "Add, edit, track product catalog" },
              { href: "/dashboard/inventory/warehouses", label: "Manage Warehouses", desc: "Configure storage locations"       },
              { href: "/dashboard/inventory/orders",     label: "Purchase Orders",   desc: "Create and track supplier orders"  },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors group">
                <div>
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{link.label}</p>
                  <p className="text-xs text-muted-foreground">{link.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
