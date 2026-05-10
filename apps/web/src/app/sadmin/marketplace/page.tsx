"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Package, Eye, EyeOff, Trash2, ExternalLink, Tag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";

type MarketplaceModule = {
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
  publishedAt: string;
  isActive: boolean;
  submission: {
    developer: {
      user: { id: string; name: string; email: string };
    };
  };
};

const CATEGORY_STYLE: Record<string, string> = {
  core:        "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
  integration: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  industry:    "border-violet-500/30 bg-violet-500/10 text-violet-400",
  community:   "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  premium:     "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

const BILLING_STYLE: Record<string, string> = {
  free:    "border-slate-700 bg-slate-800 text-slate-400",
  monthly: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  yearly:  "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

function PriceEditor({
  moduleId, price, billing, onSaved,
}: {
  moduleId: string; price: number; billing: string; onSaved: () => void;
}) {
  const [editPrice, setEditPrice] = useState(String(price));
  const [editBilling, setEditBilling] = useState(billing);
  const [saving, setSaving] = useState(false);

  async function save() {
    const p = parseFloat(editPrice);
    if (isNaN(p) || p < 0) { toast.error("Invalid price"); return; }
    setSaving(true);
    try {
      await apiPatch(`/api/sadmin/marketplace/${moduleId}`, { price: p, billing: editBilling });
      toast.success("Pricing updated");
      onSaved();
    } catch { toast.error("Failed to update pricing"); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 text-[11px]">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={editPrice}
        onChange={(e) => setEditPrice(e.target.value)}
        className="w-16 h-7 px-1.5 text-[12px] rounded bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:border-cyan-500/50 [appearance:textfield]"
      />
      <select
        value={editBilling}
        onChange={(e) => setEditBilling(e.target.value)}
        className="h-7 px-1.5 text-[11px] rounded bg-slate-800 border border-slate-700 text-slate-400 focus:outline-none focus:border-cyan-500/50"
      >
        <option value="free">free</option>
        <option value="monthly">monthly</option>
        <option value="yearly">yearly</option>
      </select>
      <button
        onClick={() => void save()}
        disabled={saving}
        className="px-2 h-7 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-colors disabled:opacity-40"
      >
        {saving ? "…" : "Set"}
      </button>
    </div>
  );
}

export default function MarketplacePage() {
  const [modules, setModules]   = useState<MarketplaceModule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ modules: MarketplaceModule[] }>("/api/sadmin/marketplace");
      setModules(res.modules);
    } catch { toast.error("Failed to load marketplace modules"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggleActive(mod: MarketplaceModule) {
    setTogglingId(mod.id);
    try {
      await apiPatch(`/api/sadmin/marketplace/${mod.id}`, { isActive: !mod.isActive });
      toast.success(mod.isActive ? "Module deactivated" : "Module activated");
      setModules((prev) => prev.map((m) => m.id === mod.id ? { ...m, isActive: !m.isActive } : m));
    } catch { toast.error("Failed to update module"); }
    finally { setTogglingId(null); }
  }

  async function handleDelete(mod: MarketplaceModule) {
    if (!confirm(`Remove "${mod.name}" from the marketplace? This cannot be undone.`)) return;
    setDeletingId(mod.id);
    try {
      await apiDelete(`/api/sadmin/marketplace/${mod.id}`);
      toast.success(`"${mod.name}" removed from marketplace`);
      setModules((prev) => prev.filter((m) => m.id !== mod.id));
    } catch { toast.error("Failed to remove module"); }
    finally { setDeletingId(null); }
  }

  const activeCount   = modules.filter((m) => m.isActive).length;
  const inactiveCount = modules.length - activeCount;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Marketplace</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {loading ? "Loading…" : `${modules.length} published module${modules.length !== 1 ? "s" : ""} — ${activeCount} active, ${inactiveCount} inactive`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}
          className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary chips */}
      {!loading && modules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(
            modules.reduce<Record<string, number>>((acc, m) => {
              acc[m.category] = (acc[m.category] ?? 0) + 1;
              return acc;
            }, {})
          ).map(([cat, count]) => (
            <span key={cat} className={cn("px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize", CATEGORY_STYLE[cat] ?? "border-slate-700 text-slate-400")}>
              {cat} ({count})
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-5">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-800 animate-pulse rounded-lg" />)}
            </div>
          ) : modules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Package className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-[13px] font-medium">No published modules yet</p>
              <p className="text-[11px] mt-1">Approved submissions appear here automatically.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {["Module", "Author", "Category", "Version", "Pricing", "Installs", "Status", "Actions"].map((h) => (
                    <TableHead key={h} className="text-[11px] font-medium text-slate-500 uppercase tracking-wider h-9 px-4 first:pl-5 last:pr-5">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod) => (
                  <TableRow key={mod.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    {/* Module */}
                    <TableCell className="px-4 pl-5 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-slate-200">{mod.name}</span>
                          <a href={mod.repoUrl} target="_blank" rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-400 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <span className="text-[10px] font-mono text-slate-600">{mod.key}</span>
                      </div>
                    </TableCell>

                    {/* Author */}
                    <TableCell className="px-4 py-3">
                      <div>
                        <p className="text-[12px] text-slate-300">{mod.author}</p>
                        <p className="text-[10px] text-slate-600 font-mono">{mod.submission.developer.user.email}</p>
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", CATEGORY_STYLE[mod.category] ?? "border-slate-700 text-slate-400")}>
                        {mod.category}
                      </Badge>
                    </TableCell>

                    {/* Version */}
                    <TableCell className="px-4 py-3 text-[12px] font-mono text-slate-500">v{mod.version}</TableCell>

                    {/* Pricing */}
                    <TableCell className="px-4 py-3">
                      <PriceEditor moduleId={mod.id} price={mod.price} billing={mod.billing} onSaved={() => void load()} />
                    </TableCell>

                    {/* Installs */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-slate-600" />
                        <span className="text-[12px] text-slate-400">{mod.installCount.toLocaleString()}</span>
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="px-4 py-3">
                      <span className={cn(
                        "text-[11px] font-medium px-2 py-0.5 rounded-full border",
                        mod.isActive
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-slate-500 bg-slate-800 border-slate-700"
                      )}>
                        {mod.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 pr-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => void toggleActive(mod)}
                          disabled={togglingId === mod.id}
                          title={mod.isActive ? "Deactivate" : "Activate"}
                          className={cn(
                            "p-1.5 rounded-lg border transition-colors disabled:opacity-40",
                            mod.isActive
                              ? "border-amber-700/40 bg-amber-900/10 text-amber-400 hover:bg-amber-900/30"
                              : "border-emerald-700/40 bg-emerald-900/10 text-emerald-400 hover:bg-emerald-900/30"
                          )}>
                          {mod.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => void handleDelete(mod)}
                          disabled={deletingId === mod.id}
                          title="Remove from marketplace"
                          className="p-1.5 rounded-lg border border-red-800/40 bg-red-900/10 text-red-400 hover:bg-red-900/30 transition-colors disabled:opacity-40">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
