"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Download, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

type Org = {
  id: string; name: string; slug: string; plan: string; status: string;
  trialEnds: string | null; createdAt: string;
  _count: { members: number; modules: number };
};

const STATUS_STYLE: Record<string, string> = {
  trial:     "border-amber-500/30 bg-amber-500/10 text-amber-400",
  active:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  suspended: "border-red-500/30 bg-red-500/10 text-red-400",
  cancelled: "border-slate-700 bg-slate-800 text-slate-500",
};
const PLAN_STYLE: Record<string, string> = {
  starter:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  growth:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  pro:        "border-violet-500/30 bg-violet-500/10 text-violet-400",
  enterprise: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function exportCSV(orgs: Org[]) {
  const headers = ["Name", "Slug", "Plan", "Status", "Members", "Modules", "Trial Ends", "Created"];
  const rows = orgs.map((o) => [
    o.name, o.slug, o.plan, o.status,
    o._count.members, o._count.modules,
    o.trialEnds ? new Date(o.trialEnds).toLocaleDateString() : "",
    new Date(o.createdAt).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function SubscriptionsPage() {
  const [orgs, setOrgs]         = useState<Org[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async (q = search, p = page, s = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "25", page: String(p), search: q, status: s });
      const res = await apiGet<{ organizations: Org[]; total: number }>(`/api/sadmin/organizations?${params}`);
      setOrgs(res.organizations);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, [search, page, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function handleUpdate(id: string, data: Record<string, string>) {
    setUpdating(id);
    try {
      await apiPatch(`/api/sadmin/organizations/${id}`, data);
      toast.success("Updated successfully");
      await load();
    } catch { toast.error("Update failed"); }
    finally { setUpdating(null); }
  }

  function handleFilterChange(s: string) {
    setStatusFilter(s);
    setPage(1);
    void load(search, 1, s);
  }

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Subscriptions</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">{total} organizations total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(orgs)} disabled={orgs.length === 0}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white">
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
          <Input placeholder="Search organizations…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(search, 1); } }}
            className="pl-8 h-8 text-[12px] w-56 bg-slate-800 border-slate-700 text-slate-300 placeholder:text-slate-600 focus-visible:ring-cyan-500/30" />
        </div>
        {(["all", "trial", "active", "suspended", "cancelled"] as const).map((s) => (
          <button key={s} onClick={() => handleFilterChange(s)}
            className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors capitalize",
              statusFilter === s
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                : "bg-slate-800/80 text-slate-500 hover:bg-slate-700 hover:text-slate-300 border border-slate-700/50")}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {["Organization", "Plan", "Status", "Trial Ends", "Members", "Modules", "Created"].map((h) => (
                    <TableHead key={h} className="text-[11px] font-medium text-slate-500 uppercase tracking-wider h-10">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-800">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-800 animate-pulse rounded w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orgs.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={7} className="text-center text-slate-600 py-12 text-[13px]">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : orgs.map((org) => {
                  const days = org.trialEnds ? daysUntil(org.trialEnds) : null;
                  const expiringSoon = org.status === "trial" && days !== null && days <= 3;
                  return (
                    <TableRow key={org.id}
                      className={cn("border-slate-800 hover:bg-slate-800/30 transition-colors",
                        expiringSoon && "bg-amber-500/5")}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {expiringSoon && <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          <div>
                            <p className="text-[13px] font-medium text-slate-200">{org.name}</p>
                            <p className="text-[11px] text-slate-600 font-mono">{org.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select value={org.plan} onValueChange={(v) => v && void handleUpdate(org.id, { plan: v })} disabled={updating === org.id}>
                          <SelectTrigger className="h-7 text-[12px] w-28 bg-slate-800 border-slate-700 text-slate-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {["starter", "growth", "pro", "enterprise"].map((p) => (
                              <SelectItem key={p} value={p} className="text-[12px] capitalize text-slate-300">{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={org.status} onValueChange={(v) => v && void handleUpdate(org.id, { status: v })} disabled={updating === org.id}>
                          <SelectTrigger className="h-7 text-[12px] w-28 bg-slate-800 border-slate-700 text-slate-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700">
                            {["trial", "active", "suspended", "cancelled"].map((s) => (
                              <SelectItem key={s} value={s} className="text-[12px] capitalize text-slate-300">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {org.trialEnds ? (
                          <span className={cn("text-[12px]", expiringSoon ? "text-amber-400 font-medium" : "text-slate-500")}>
                            {expiringSoon && days === 0 ? "Today" : expiringSoon && days === 1 ? "Tomorrow" :
                              expiringSoon ? `${days}d left` : new Date(org.trialEnds).toLocaleDateString()}
                          </span>
                        ) : <span className="text-slate-700">—</span>}
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-500">{org._count.members}</TableCell>
                      <TableCell className="text-[13px] text-slate-500">{org._count.modules}</TableCell>
                      <TableCell className="text-[11px] text-slate-600">{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 25 && (
        <div className="flex items-center justify-between text-[12px] text-slate-500">
          <span>{Math.min((page - 1) * 25 + 1, total)}–{Math.min(page * 25, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1}
              onClick={() => { setPage((p) => p - 1); void load(search, page - 1); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <button disabled={page * 25 >= total}
              onClick={() => { setPage((p) => p + 1); void load(search, page + 1); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
