"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Store, Code2, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { apiPost, apiDelete, apiGet } from "@/lib/api";
import type { ModuleMeta, StoreCategory } from "@business360/shared";
import { StoreModuleCard } from "@/components/store/StoreModuleCard";
import Link from "next/link";

const PLAN_RANK: Record<string, number> = { starter: 0, growth: 1, pro: 2, enterprise: 3 };

const CATEGORIES: { key: StoreCategory | "all"; label: string }[] = [
  { key: "all",         label: "All Apps" },
  { key: "core",        label: "Core Modules" },
  { key: "integration", label: "Integrations" },
  { key: "industry",    label: "Industry Packs" },
  { key: "community",   label: "Community" },
  { key: "premium",     label: "Premium" },
];

const FILTERS = [
  { key: "all",       label: "All" },
  { key: "installed", label: "Installed" },
  { key: "available", label: "Available" },
  { key: "locked",    label: "Locked" },
];

type EnrichedModule = ModuleMeta & { installed: boolean; available: boolean };

type MarketplaceMod = {
  id: string;
  key: string;
  name: string;
  version: string;
  category: string;
  description: string;
  author: string;
  repoUrl: string;
  price: number;
  billing: string;
  rating: number;
  installCount: number;
  isActive: boolean;
};

export default function StorePage() {
  const { org, refresh } = useAuth();
  const [search, setSearch]       = useState("");
  const [category, setCategory]   = useState<StoreCategory | "all">("all");
  const [filter, setFilter]       = useState("all");
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [catalog, setCatalog]     = useState<EnrichedModule[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceMod[]>([]);

  // Fetch catalog whenever org changes (so installed state stays fresh)
  useEffect(() => {
    apiGet<{ catalog: EnrichedModule[] }>("/api/store/catalog")
      .then((res) => setCatalog(res.catalog))
      .catch(() => {});
  }, [org]);

  useEffect(() => {
    apiGet<{ modules: MarketplaceMod[] }>("/api/store/marketplace")
      .then((res) => setMarketplace(res.modules))
      .catch(() => {});
  }, []);

  // Re-enrich with local plan rank in case API enrichment differs
  const enriched = useMemo(() => {
    const orgPlanRank = PLAN_RANK[org?.plan ?? "starter"] ?? 0;
    const installedKeys = new Set(org?.modules.map((m) => m.moduleKey) ?? []);
    return catalog.map((mod) => ({
      ...mod,
      installed: installedKeys.has(mod.key),
      available: PLAN_RANK[mod.requiredPlan] <= orgPlanRank,
    }));
  }, [catalog, org]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (category !== "all") list = list.filter((m) => m.category === category);
    if (filter === "installed") list = list.filter((m) => m.installed);
    if (filter === "available") list = list.filter((m) => m.available && !m.installed);
    if (filter === "locked")    list = list.filter((m) => !m.available);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        (m.tags ?? []).some((t) => t.includes(q))
      );
    }
    return list;
  }, [enriched, category, filter, search]);

  async function handleInstall(moduleKey: string) {
    setError(null);
    setInstalling(moduleKey);
    try {
      await apiPost("/api/modules/install", { moduleKey });
      await refresh();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uninstall failed");
    } finally {
      setInstalling(null);
    }
  }

  const stats = {
    total:     enriched.length,
    installed: enriched.filter((m) => m.installed).length,
    available: enriched.filter((m) => m.available && !m.installed && !m.isComingSoon).length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">App Store</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {stats.installed} installed · {stats.available} available · {stats.total} total apps
          </p>
        </div>
        <Link href="/dashboard/store/developer">
          <Button variant="outline" size="sm" className="gap-2">
            <Code2 className="w-4 h-4" />
            Submit an App
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search apps, integrations, industry packs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map(({ key, label }) => {
          const count = key === "all"
            ? enriched.length
            : enriched.filter((m) => m.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5",
                category === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {label}
              <Badge variant="outline" className={cn("text-xs px-1.5 py-0 h-4", category === key ? "border-white/30 text-white bg-white/10" : "border-border text-muted-foreground")}>
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Filter:</span>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
              filter === key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} apps</span>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Store className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No apps found. Try a different search or filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mod) => (
            <StoreModuleCard
              key={mod.key}
              mod={mod}
              busy={installing === mod.key}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />
          ))}
        </div>
      )}

      {/* Community Marketplace */}
      {marketplace.length > 0 && (category === "all" || category === "community" || category === "integration") && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-semibold text-muted-foreground px-2">COMMUNITY MARKETPLACE</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <p className="text-xs text-muted-foreground">
            Third-party modules submitted by developers and approved by the Business360 team.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {marketplace
              .filter((m) => {
                if (search.trim()) {
                  const q = search.toLowerCase();
                  return m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.author.toLowerCase().includes(q);
                }
                return true;
              })
              .map((mod) => (
                <div key={mod.id} className="rounded-xl border bg-card p-5 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{mod.name}</p>
                        <Badge variant="outline" className="text-xs border-primary/30 bg-primary/5 text-primary shrink-0">
                          Marketplace
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">by {mod.author} · v{mod.version}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{mod.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs capitalize">{mod.category}</Badge>
                      {mod.rating > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-500">
                          <Star className="w-3 h-3 fill-current" /> {mod.rating.toFixed(1)}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {mod.price === 0 ? "Free" : `$${mod.price}/${mod.billing}`}
                      </span>
                    </div>
                    <a
                      href={mod.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
