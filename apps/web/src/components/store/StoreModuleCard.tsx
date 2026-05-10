"use client";

import {
  Users, Boxes, Calculator, UserCheck, Package, BarChart3,
  CreditCard, MessageSquare, Phone, Zap, Globe,
  ShoppingCart, Truck, Activity, Sparkles, TrendingUp,
  Star, CheckCircle2, Lock, Loader2, Plus, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ModuleMeta } from "@business360/shared";

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

const CAT_COLOR: Record<string, string> = {
  core:        "bg-primary/10 text-primary",
  integration: "bg-blue-50 text-blue-600",
  industry:    "bg-emerald-50 text-emerald-600",
  community:   "bg-orange-50 text-orange-600",
  premium:     "bg-violet-50 text-violet-600",
};

interface Props {
  mod: ModuleMeta & { installed?: boolean; available?: boolean };
  busy?: boolean;
  onInstall?: (key: string) => void;
  onUninstall?: (key: string) => void;
}

export function StoreModuleCard({ mod, busy = false, onInstall, onUninstall }: Props) {
  const Icon = ICON_MAP[mod.icon] ?? Package;
  const installed = mod.installed ?? false;
  const available = mod.available ?? false;

  return (
    <div className={cn(
      "rounded-xl border p-5 flex flex-col gap-4 transition-all hover:shadow-sm",
      installed
        ? "bg-card border-primary/20"
        : available
        ? "bg-card border-border/70 hover:border-border"
        : "bg-muted/30 border-border/40"
    )}>
      {/* Top row: icon + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", CAT_COLOR[mod.category ?? "core"] ?? "bg-muted text-muted-foreground")}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {mod.isComingSoon && (
            <Badge variant="outline" className="text-xs border-muted-foreground/20 bg-muted/50 text-muted-foreground">
              <Clock className="w-2.5 h-2.5 mr-1" />Soon
            </Badge>
          )}
          {mod.price !== null && (
            <Badge variant="outline" className="text-xs border-violet-200 bg-violet-50 text-violet-700">
              ${mod.price}/mo
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-xs capitalize", PLAN_BADGE[mod.requiredPlan] ?? "")}>
            {mod.requiredPlan}+
          </Badge>
        </div>
      </div>

      {/* Name + version + rating */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <h3 className={cn("font-semibold text-sm", !available && "text-muted-foreground/60")}>
              {mod.name}
            </h3>
            {installed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            {!available && !mod.isComingSoon && <Lock className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
          </div>
          <span className="text-xs text-muted-foreground/60 shrink-0">v{mod.version}</span>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map((s) => (
            <Star key={s} className={cn("w-2.5 h-2.5", s <= Math.round(mod.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20")} />
          ))}
          <span className="text-xs text-muted-foreground ml-1">{mod.rating ?? 0} ({mod.reviewCount ?? 0})</span>
        </div>

        <p className={cn("text-xs leading-relaxed", available ? "text-muted-foreground" : "text-muted-foreground/40")}>
          {mod.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {(mod.tags ?? []).slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link href={`/dashboard/store/${mod.key}`} className="flex-1">
          <Button size="sm" variant="outline" className="w-full text-xs">Details</Button>
        </Link>
        {mod.isComingSoon ? (
          <Button size="sm" className="flex-1 text-xs" disabled>
            <Clock className="w-3 h-3 mr-1" />Soon
          </Button>
        ) : available ? (
          installed ? (
            <Button size="sm" variant="outline" className="flex-1 text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
              disabled={busy} onClick={() => onUninstall?.(mod.key)}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Uninstall"}
            </Button>
          ) : (
            <Button size="sm" className="flex-1 text-xs" disabled={busy} onClick={() => onInstall?.(mod.key)}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 mr-1" />Install</>}
            </Button>
          )
        ) : (
          <Button size="sm" variant="outline" className="flex-1 text-xs opacity-50" disabled>
            <Lock className="w-3 h-3 mr-1" />Upgrade
          </Button>
        )}
      </div>
    </div>
  );
}
