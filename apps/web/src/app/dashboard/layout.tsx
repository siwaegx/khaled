"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { AppHeader } from "@/components/dashboard/AppHeader";
import { CommandPalette } from "@/components/dashboard/CommandPalette";
import { cn } from "@/lib/utils";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, org, loading, impersonated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  async function handleExitImpersonation() {
    setExiting(true);
    try {
      await fetch(`${BASE_URL}/api/auth/exit-impersonation`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      window.location.href = "/sadmin";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={cn("flex h-screen overflow-hidden bg-muted/20", impersonated && "pt-10")}>
      {impersonated && (
        <div className="fixed top-0 left-0 right-0 z-50 h-10 bg-amber-500 text-black flex items-center justify-between px-4 text-[13px] font-semibold">
          <span>
            Admin Mode — viewing as{" "}
            <span className="font-bold">{org?.name ?? "..."}</span>
          </span>
          <button
            onClick={() => void handleExitImpersonation()}
            disabled={exiting}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-black/15 hover:bg-black/25 transition-colors text-[12px] disabled:opacity-60">
            {exiting ? "Exiting…" : "← Exit to Admin Panel"}
          </button>
        </div>
      )}
      <AppSidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AppHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="min-w-0 overflow-x-auto">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
