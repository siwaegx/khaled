"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Building2, Users, Package,
  DollarSign, BarChart3, LogOut, Zap, ChevronRight, ChevronLeft,
  Store, Settings, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AdminUser = { name: string; email: string };

export default function SAdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin]             = useState<AdminUser | null>(null);
  const [ready, setReady]             = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (pathname === "/sadmin/login") { setReady(true); return; }
    void (async () => {
      try {
        const res  = await fetch(`${BASE_URL}/api/auth/me`, { credentials: "include" });
        if (!res.ok) { router.replace("/sadmin/login"); return; }
        const data = await res.json() as { isAdmin?: boolean; user?: AdminUser };
        if (!data.isAdmin) { router.replace("/sadmin/login"); return; }
        setAdmin(data.user ?? null);
        setReady(true);
      } catch { router.replace("/sadmin/login"); }
    })();
  }, [pathname, router]);

  // Fetch pending submissions count for badge
  useEffect(() => {
    if (!ready || pathname === "/sadmin/login") return;
    void (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/sadmin/alerts`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json() as { pendingSubmissions?: number };
          setPendingCount(data.pendingSubmissions ?? 0);
        }
      } catch { /* silent */ }
    })();
  }, [ready, pathname]);

  async function handleLogout() {
    await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    router.replace("/sadmin/login");
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pathname === "/sadmin/login") return <>{children}</>;

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  }

  const NAV = [
    { href: "/sadmin",               icon: LayoutDashboard, label: "Overview",       exact: true,  badge: 0 },
    { href: "/sadmin/subscriptions", icon: DollarSign,      label: "Subscriptions",  exact: false, badge: 0 },
    { href: "/sadmin/plans",         icon: BarChart3,       label: "Plans & MRR",    exact: false, badge: 0 },
    { href: "/sadmin/users",         icon: Users,           label: "Users",          exact: false, badge: 0 },
    { href: "/sadmin/orgs",          icon: Building2,       label: "Organizations",  exact: false, badge: 0 },
    { href: "/sadmin/submissions",   icon: Package,         label: "Submissions",    exact: false, badge: pendingCount },
    { href: "/sadmin/marketplace",   icon: Store,           label: "Marketplace",    exact: false, badge: 0 },
    { href: "/sadmin/ai-log",        icon: Bot,             label: "AI Log",         exact: false, badge: 0 },
    { href: "/sadmin/settings",      icon: Settings,        label: "Settings",       exact: false, badge: 0 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-slate-800 bg-slate-900/60 transition-all duration-200 shrink-0",
        collapsed ? "w-[60px]" : "w-56"
      )}>
        {/* Brand */}
        <div className={cn(
          "flex items-center border-b border-slate-800 h-14",
          collapsed ? "justify-center px-0" : "justify-between px-4"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[11px] tracking-tight text-white leading-none">Business360</p>
                <p className="text-[9px] text-cyan-400 font-semibold tracking-widest uppercase mt-0.5">Platform Admin</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)}
              className="p-1 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {collapsed && (
          <button onClick={() => setCollapsed(false)}
            className="mx-auto mt-3 p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label, exact, badge }) => {
            const active = isActive(href, exact);
            return (
              <Link key={href} href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all",
                  active
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200 border border-transparent",
                  collapsed && "justify-center px-0"
                )}>
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{label}</span>
                    {badge > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 leading-none">
                        {badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && badge > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-800 p-2 space-y-1">
          {!collapsed && admin && (
            <div className="px-2.5 py-2 mb-0.5">
              <p className="text-[12px] font-semibold text-slate-200 truncate">{admin.name}</p>
              <p className="text-[10px] text-cyan-400 font-medium truncate">{admin.email}</p>
            </div>
          )}
          <button onClick={() => void handleLogout()}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-slate-500 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all",
              collapsed && "justify-center px-0"
            )}>
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-6 h-14 border-b border-slate-800 bg-slate-900/40 shrink-0">
          <div className="flex items-center gap-1.5 text-[12px]">
            <span className="text-slate-500">Platform Control</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-300 font-medium">
              {NAV.find((n) => isActive(n.href, n.exact))?.label ?? "Overview"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <Link href="/sadmin/submissions"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors">
                <Package className="w-3 h-3" />
                {pendingCount} pending review
              </Link>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Admin
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
