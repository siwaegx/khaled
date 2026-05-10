"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, ChevronRight, Download, HardDriveDownload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet } from "@/lib/api";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

function exportCSV(orgs: Org[]) {
  const headers = ["Name", "Slug", "Plan", "Status", "Members", "Modules", "Created"];
  const rows = orgs.map((o) => [
    o.name, o.slug, o.plan, o.status, o._count.members, o._count.modules,
    new Date(o.createdAt).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `organizations-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function OrgsPage() {
  const [orgs, setOrgs]         = useState<Org[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading]   = useState(true);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  async function downloadBulkBackup() {
    setBulkDownloading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/sadmin/backup`, { credentials: "include" });
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulk-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBulkDownloading(false);
    }
  }

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

  function handleFilterChange(s: string) {
    setStatusFilter(s);
    setPage(1);
    void load(search, 1, s);
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Organizations</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">{total} organizations total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(orgs)} disabled={orgs.length === 0}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void downloadBulkBackup()} disabled={bulkDownloading}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40">
            <HardDriveDownload className="w-3.5 h-3.5 mr-1.5" />
            {bulkDownloading ? "Backing up…" : "Bulk Backup"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white">
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

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

      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {["Organization", "Plan", "Status", "Members", "Modules", "Created", ""].map((h, i) => (
                    <TableHead key={i} className="text-[11px] font-medium text-slate-500 uppercase tracking-wider h-10">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-800">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-800 animate-pulse rounded" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orgs.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={7} className="text-center text-slate-600 py-12 text-[13px]">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : orgs.map((org) => (
                  <TableRow key={org.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell>
                      <div>
                        <p className="text-[13px] font-medium text-slate-200">{org.name}</p>
                        <p className="text-[11px] text-slate-600 font-mono">{org.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[11px] capitalize", PLAN_STYLE[org.plan] ?? "")}>
                        {org.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[11px] capitalize", STATUS_STYLE[org.status] ?? "")}>
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px] text-slate-500">{org._count.members}</TableCell>
                    <TableCell className="text-[13px] text-slate-500">{org._count.modules}</TableCell>
                    <TableCell className="text-[11px] text-slate-600">{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/sadmin/orgs/${org.id}`}
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-600 hover:text-slate-200 hover:bg-slate-700 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {total > 25 && (
        <div className="flex items-center justify-between text-[12px] text-slate-500">
          <span>{Math.min((page - 1) * 25 + 1, total)}–{Math.min(page * 25, total)} of {total}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => { setPage((p) => p - 1); void load(search, page - 1); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition-colors">
              Previous
            </button>
            <button disabled={page * 25 >= total} onClick={() => { setPage((p) => p + 1); void load(search, page + 1); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
