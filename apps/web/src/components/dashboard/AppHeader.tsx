"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, ChevronRight, Sun, Moon, Bell, AlertTriangle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";

const BREADCRUMBS: Record<string, string[]> = {
  "/dashboard":                  ["Dashboard"],
  "/dashboard/modules":          ["Dashboard", "My Modules"],
  "/dashboard/settings":         ["Dashboard", "Settings"],
  "/dashboard/admin":            ["Dashboard", "Admin Panel"],
  "/dashboard/store":            ["Dashboard", "App Store"],
  "/dashboard/store/developer":  ["Dashboard", "App Store", "Developer"],
  "/dashboard/crm":              ["Dashboard", "CRM"],
  "/dashboard/crm/leads":        ["Dashboard", "CRM", "Leads"],
  "/dashboard/crm/deals":        ["Dashboard", "CRM", "Deals"],
  "/dashboard/crm/customers":    ["Dashboard", "CRM", "Customers"],
  "/dashboard/inventory":              ["Dashboard", "Inventory"],
  "/dashboard/inventory/products":     ["Dashboard", "Inventory", "Products"],
  "/dashboard/inventory/warehouses":   ["Dashboard", "Inventory", "Warehouses"],
  "/dashboard/inventory/orders":       ["Dashboard", "Inventory", "Purchase Orders"],
  "/dashboard/accounting":             ["Dashboard", "Accounting"],
  "/dashboard/accounting/invoices":    ["Dashboard", "Accounting", "Invoices"],
  "/dashboard/accounting/expenses":    ["Dashboard", "Accounting", "Expenses"],
  "/dashboard/hr":                     ["Dashboard", "HR"],
  "/dashboard/hr/employees":           ["Dashboard", "HR", "Employees"],
  "/dashboard/hr/leave":               ["Dashboard", "HR", "Leave Requests"],
  "/dashboard/projects":               ["Dashboard", "Projects"],
  "/dashboard/projects/tasks":         ["Dashboard", "Projects", "Tasks"],
  "/dashboard/reports":                ["Dashboard", "Reports"],
};

type AlertInvoice = { id: string; number: string; customerName: string; dueDate: string; total: number };
type AlertStock   = { id: string; quantity: number; minQuantity: number; product: { name: string; sku: string }; warehouse: { name: string } };
type Alerts = { overdueInvoices: AlertInvoice[]; lowStock: AlertStock[] };

interface Props {
  onMenuClick: () => void;
}

export function AppHeader({ onMenuClick }: Props) {
  const { user, logout } = useAuth();
  const router   = useRouter();
  const pathname = usePathname();
  const [dark, setDark]         = useState(false);
  const [alerts, setAlerts]     = useState<Alerts | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    apiGet<Alerts>("/api/reports/alerts").then(setAlerts).catch(() => {});
  }, []);

  useEffect(() => {
    if (!bellOpen) return;
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [bellOpen]);

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
    setDark(isDark);
  }

  const crumbs    = BREADCRUMBS[pathname] ?? ["Dashboard"];
  const pageTitle = crumbs[crumbs.length - 1];
  const initials  = user?.name
    ? user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const alertCount = (alerts?.overdueInvoices.length ?? 0) + (alerts?.lowStock.length ?? 0);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="h-14 shrink-0 border-b bg-background/95 backdrop-blur-sm flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="md:hidden p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav className="flex items-center gap-1 text-sm min-w-0">
          {crumbs.length > 1 && (
            <>
              <span className="text-muted-foreground/50 hidden sm:block truncate">
                {crumbs.slice(0, -1).join(" / ")}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block shrink-0" />
            </>
          )}
          <span className="font-semibold text-foreground truncate">{pageTitle}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Dark mode toggle */}
        <Button
          variant="ghost" size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground w-8 h-8"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* Alerts bell */}
        <div className="relative" ref={bellRef}>
          <Button
            variant="ghost" size="icon"
            onClick={() => setBellOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground w-8 h-8 relative"
            title="Alerts"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            )}
          </Button>

          {bellOpen && (
            <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border bg-popover shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-semibold">Alerts</p>
                {alertCount === 0 && <p className="text-xs text-muted-foreground mt-0.5">All clear — no issues detected</p>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {(alerts?.overdueInvoices.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2 border-b bg-muted/30">
                      Overdue Invoices
                    </p>
                    {alerts!.overdueInvoices.map((inv) => (
                      <div key={inv.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 border-b last:border-0">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{inv.number} — {inv.customerName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            ${inv.total.toLocaleString()} · Due {new Date(inv.dueDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(alerts?.lowStock.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2 border-b bg-muted/30">
                      Low Stock
                    </p>
                    {alerts!.lowStock.map((sl) => (
                      <div key={sl.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 border-b last:border-0">
                        <Package className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{sl.product.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {sl.quantity} / {sl.minQuantity} min · {sl.warehouse.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {alertCount === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    No active alerts
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center shrink-0 shadow-glow-sm">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-semibold leading-none">{user?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
            </div>
          </div>
        </div>

        <Button
          variant="ghost" size="icon"
          onClick={handleLogout}
          className={cn("text-muted-foreground hover:text-foreground w-8 h-8 hover:bg-destructive/8 hover:text-destructive transition-colors")}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
