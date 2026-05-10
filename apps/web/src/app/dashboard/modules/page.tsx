"use client";

import { useState, useEffect } from "react";
import {
  Users, Boxes, Calculator, UserCheck,
  Package, BarChart3, CheckCircle2, Lock, Plus, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { apiPost, apiDelete, apiGet } from "@/lib/api";
import type { ModuleMeta } from "@business360/shared";

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Boxes, Calculator, UserCheck, Package, BarChart3,
};

const PLAN_BADGE: Record<string, string> = {
  starter:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  growth:     "border-blue-200 bg-blue-50 text-blue-700",
  pro:        "border-violet-200 bg-violet-50 text-violet-700",
  enterprise: "border-amber-200 bg-amber-50 text-amber-700",
};

const PLAN_RANK: Record<string, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };

type CatalogModule = ModuleMeta & { installed: boolean; available: boolean };

export default function ModulesPage() {
  const { org, refresh } = useAuth();
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [catalog, setCatalog]       = useState<CatalogModule[]>([]);

  const orgPlanRank = PLAN_RANK[org?.plan ?? "starter"] ?? 0;

  useEffect(() => {
    apiGet<{ catalog: CatalogModule[] }>("/api/store/catalog")
      .then((data) => setCatalog(data.catalog))
      .catch(() => {/* catalog stays empty — API not yet ready */});
  }, [org]);

  async function handleInstall(moduleKey: string) {
    setError(null);
    setInstalling(moduleKey);
    try {
      await apiPost("/api/modules/install", { moduleKey });
      await refresh();
      const data = await apiGet<{ catalog: CatalogModule[] }>("/api/store/catalog");
      setCatalog(data.catalog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(null);
    }
  }

  async function handleUninstall(moduleKey: string) {
    setError(null);
    setInstalling(moduleKey);
    try {
      await apiDelete(`/api/modules/${moduleKey}`);
      await refresh();
      const data = await apiGet<{ catalog: CatalogModule[] }>("/api/store/catalog");
      setCatalog(data.catalog);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uninstall failed");
    } finally {
      setInstalling(null);
    }
  }

  const availableCount = catalog.filter((m) => PLAN_RANK[m.requiredPlan] <= orgPlanRank).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modules</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Install and manage modules for your organization.
          Your <span className="font-medium capitalize">{org?.plan}</span> plan
          includes {availableCount} module{availableCount !== 1 ? "s" : ""}.
        </p>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {catalog.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-12 border rounded-xl bg-muted/20">
          Loading modules…
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((mod) => {
            const Icon      = ICON_MAP[mod.icon] ?? Package;
            const installed = mod.installed;
            const available = mod.available;
            const busy      = installing === mod.key;

            return (
              <div
                key={mod.key}
                className={cn(
                  "rounded-xl border p-5 flex flex-col gap-4 transition-all",
                  installed
                    ? "bg-card border-primary/20 shadow-sm"
                    : available
                    ? "bg-card border-border/70 hover:border-border"
                    : "bg-muted/30 border-border/40"
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    installed ? "bg-primary/10 text-primary" : available ? "bg-muted text-muted-foreground" : "bg-muted/50 text-muted-foreground/40"
                  )}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("text-xs capitalize shrink-0", PLAN_BADGE[mod.requiredPlan] ?? "")}
                  >
                    {mod.requiredPlan}+
                  </Badge>
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={cn("font-semibold text-sm", !available && "text-muted-foreground/50")}>
                      {mod.name}
                    </h3>
                    {installed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    {!available && <Lock className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                  </div>
                  <p className={cn("text-xs leading-relaxed", available ? "text-muted-foreground" : "text-muted-foreground/40")}>
                    {mod.description}
                  </p>
                </div>

                {/* Action */}
                {available ? (
                  installed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      disabled={busy}
                      onClick={() => handleUninstall(mod.key)}
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Uninstall
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      disabled={busy}
                      onClick={() => handleInstall(mod.key)}
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                      Install
                    </Button>
                  )
                ) : (
                  <Button size="sm" variant="outline" className="w-full text-xs opacity-50" disabled>
                    <Lock className="w-3 h-3 mr-1" />
                    Upgrade to {mod.requiredPlan}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
