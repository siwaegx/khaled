"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap, LayoutDashboard, Settings, Users, Boxes,
  Calculator, Package, BarChart3, Lock, X, Store, Shield, CreditCard, Activity, BookUser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const NAV_MAIN = [
  { href: "/dashboard",         icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/dashboard/store",   icon: Store,           label: "App Store",  exact: false },
  { href: "/dashboard/modules", icon: Package,         label: "My Modules", exact: false },
];

const MODULE_NAV = [
  { key: "crm",        href: "/dashboard/crm",        icon: Users,      label: "CRM" },
  { key: "contacts",   href: "/dashboard/contacts",   icon: BookUser,   label: "Contacts" },
  { key: "inventory",  href: "/dashboard/inventory",  icon: Boxes,      label: "Inventory" },
  { key: "accounting", href: "/dashboard/accounting", icon: Calculator, label: "Accounting" },
  { key: "projects",   href: "/dashboard/projects",   icon: Package,    label: "Projects" },
  { key: "reports",    href: "/dashboard/reports",    icon: BarChart3,  label: "Reports" },
];

const KNOWN_MODULE_KEYS = new Set(MODULE_NAV.map((m) => m.key));

const NAV_BOTTOM = [
  { href: "/dashboard/activity", icon: Activity,   label: "Activity"  },
  { href: "/dashboard/billing",  icon: CreditCard, label: "Billing"   },
  { href: "/dashboard/settings", icon: Settings,   label: "Settings"  },
];

const PLAN_COLORS: Record<string, string> = {
  starter:    "bg-blue-500/10 text-blue-600",
  growth:     "bg-emerald-500/10 text-emerald-600",
  pro:        "bg-violet-500/10 text-violet-600",
  enterprise: "bg-amber-500/10 text-amber-600",
};

interface Props {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: Props) {
  const pathname = usePathname();
  const { org, isAdmin } = useAuth();
  const installedKeys = new Set(org?.modules.map((m) => m.moduleKey) ?? []);

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  const linkClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150",
      active
        ? "bg-primary/10 text-primary font-semibold"
        : "text-sidebar-foreground/65 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    );

  const orgPlan = org?.plan?.toLowerCase() ?? "";
  const planColorClass = PLAN_COLORS[orgPlan] ?? "bg-muted text-muted-foreground";

  const orgInitial = org?.name?.[0]?.toUpperCase() ?? "O";

  const sidebarContent = (
    <aside className="w-56 flex flex-col border-r border-sidebar-border bg-sidebar h-full">
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0 shadow-glow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-tight">Business360</span>
        </div>
        {onMobileClose && (
          <button
            className="md:hidden p-1 rounded hover:bg-sidebar-accent transition-colors"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="w-4 h-4 text-sidebar-foreground/60" />
          </button>
        )}
      </div>

      {/* Org context */}
      {org && (
        <div className="px-3 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center shrink-0 text-white text-xs font-bold">
              {orgInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-tight">{org.name}</p>
              <span className={cn("inline-block text-[10px] font-semibold rounded-full px-1.5 py-0.5 mt-0.5 capitalize", planColorClass)}>
                {org.plan}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map(({ href, icon: Icon, label, exact }) => (
          <Link key={href} href={href} className={linkClass(isActive(href, exact))} onClick={onMobileClose}>
            {isActive(href, exact) && (
              <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full bg-primary" />
            )}
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}

        <div className="pt-4 pb-1.5">
          <p className="px-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Modules</p>
        </div>

        {MODULE_NAV.map(({ key, href, icon: Icon, label }) =>
          installedKeys.has(key) ? (
            <Link key={key} href={href} className={linkClass(isActive(href))} onClick={onMobileClose}>
              {isActive(href) && (
                <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full bg-primary" />
              )}
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ) : (
            <div
              key={key}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground/35 cursor-not-allowed select-none"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              <Lock className="w-3 h-3 opacity-60" />
            </div>
          )
        )}
        {/* Dynamically render any installed module not in MODULE_NAV */}
        {[...(org?.modules ?? [])].filter((m) => !KNOWN_MODULE_KEYS.has(m.moduleKey)).map((m) => {
          const href = `/dashboard/${m.moduleKey}`;
          return (
            <Link key={m.moduleKey} href={href} className={linkClass(isActive(href))} onClick={onMobileClose}>
              {isActive(href) && (
                <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full bg-primary" />
              )}
              <Package className="w-4 h-4 shrink-0" />
              <span className="capitalize">{m.moduleKey}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
        {NAV_BOTTOM.map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href} className={linkClass(isActive(href))} onClick={onMobileClose}>
            {isActive(href) && (
              <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full bg-primary" />
            )}
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
        {isAdmin && (
          <Link href="/sadmin" className={linkClass(isActive("/sadmin"))} onClick={onMobileClose}>
            {isActive("/sadmin") && (
              <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-r-full bg-primary" />
            )}
            <Shield className="w-4 h-4 shrink-0" />
            Admin Panel
          </Link>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex md:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
