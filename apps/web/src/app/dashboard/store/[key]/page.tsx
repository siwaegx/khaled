"use client";

import { use, useState } from "react";
import {
  Users, Boxes, Calculator, UserCheck, Package, BarChart3,
  CreditCard, MessageSquare, Phone, Zap, Globe,
  ShoppingCart, Truck, Activity, Sparkles, TrendingUp,
  Star, CheckCircle2, Lock, Loader2, Plus, Clock, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { apiPost, apiDelete } from "@/lib/api";
import { MODULE_REGISTRY } from "@business360/shared";
import Link from "next/link";

const ICON_MAP: Record<string, React.ElementType> = {
  Users, Boxes, Calculator, UserCheck, Package, BarChart3,
  CreditCard, MessageSquare, Phone, Zap, Globe,
  ShoppingCart, Truck, Activity, Sparkles, TrendingUp,
};

const PLAN_BADGE: Record<string, string> = {
  starter:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  growth:     "border-blue-200 bg-blue-50 text-blue-700",
  pro:        "border-violet-200 bg-violet-50 text-violet-700",
  enterprise: "border-amber-200 bg-amber-50 text-amber-700",
};

const CAT_LABEL: Record<string, string> = {
  core: "Core Module", integration: "Integration", industry: "Industry Pack",
  community: "Community", premium: "Premium",
};

const PLAN_RANK: Record<string, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };

export default function ModuleDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { org, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mod = MODULE_REGISTRY.find((m) => m.key === key);
  if (!mod) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <p className="text-muted-foreground text-sm">Module not found.</p>
        <Link href="/dashboard/store"><Button variant="outline" className="mt-4">Back to Store</Button></Link>
      </div>
    );
  }

  const modKey = mod.key;
  const Icon = ICON_MAP[mod.icon] ?? Package;
  const installedKeys = new Set(org?.modules.map((m) => m.moduleKey) ?? []);
  const installed = installedKeys.has(modKey);
  const orgPlanRank = PLAN_RANK[org?.plan ?? "starter"] ?? 0;
  const available = PLAN_RANK[mod.requiredPlan] <= orgPlanRank;

  async function handleInstall() {
    setError(null); setSuccess(null); setBusy(true);
    try {
      await apiPost("/api/modules/install", { moduleKey: modKey });
      await refresh();
      setSuccess("Module installed successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    } finally { setBusy(false); }
  }

  async function handleUninstall() {
    setError(null); setSuccess(null); setBusy(true);
    try {
      await apiDelete(`/api/modules/${modKey}`);
      await refresh();
      setSuccess("Module uninstalled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uninstall failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/store" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Store
      </Link>

      {/* Hero card */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-primary/10 text-primary")}>
          <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-start gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{mod.name}</h1>
            {installed && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Installed</Badge>}
            {mod.isComingSoon && <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" />Coming Soon</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{CAT_LABEL[mod.category] ?? mod.category}</span>
            <span>·</span>
            <span>By {mod.author}</span>
            <span>·</span>
            <span>v{mod.version}</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} className={cn("w-3 h-3", s <= Math.round(mod.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20")} />
              ))}
              <span className="ml-1">{mod.rating} ({mod.reviewCount} reviews)</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={cn("capitalize", PLAN_BADGE[mod.requiredPlan] ?? "")}>
              {mod.requiredPlan}+ plan
            </Badge>
            {mod.price !== null
              ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">${mod.price}/month</Badge>
              : <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Free with plan</Badge>
            }
          </div>

          {/* Action */}
          {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>}
          {success && <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{success}</p>}
          <div className="flex gap-2 pt-1">
            {mod.isComingSoon ? (
              <Button disabled className="gap-2"><Clock className="w-4 h-4" />Coming Soon</Button>
            ) : available ? (
              installed ? (
                <Button variant="outline" className="text-destructive border-destructive/20" onClick={handleUninstall} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Uninstall
                </Button>
              ) : (
                <Button onClick={handleInstall} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Install Module
                </Button>
              )
            ) : (
              <Button variant="outline" disabled className="gap-2">
                <Lock className="w-4 h-4" />Requires {mod.requiredPlan} plan
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Description */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-3">
            <h2 className="font-semibold">About this module</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{mod.longDescription}</p>
          </div>
          <div className="rounded-xl border bg-card p-6 space-y-3">
            <h2 className="font-semibold">Features</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {mod.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-5 space-y-3 text-sm">
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Details</h3>
            {[
              ["Category", CAT_LABEL[mod.category] ?? mod.category],
              ["Version", mod.version],
              ["Author", mod.author],
              ["Required Plan", `${mod.requiredPlan[0]!.toUpperCase()}${mod.requiredPlan.slice(1)}+`],
              ["Price", mod.price !== null ? `$${mod.price}/month` : "Free with plan"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <h3 className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {mod.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
