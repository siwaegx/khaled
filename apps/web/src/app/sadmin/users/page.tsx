"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, RefreshCw, Shield, ShieldOff, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

type Membership = {
  role: string;
  organization: { id: string; name: string; plan: string; status: string };
};
type User = {
  id: string; name: string; email: string;
  isAdmin: boolean; createdAt: string;
  memberships: Membership[];
};

const PLAN_STYLE: Record<string, string> = {
  starter:    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  growth:     "border-blue-500/30 bg-blue-500/10 text-blue-400",
  pro:        "border-violet-500/30 bg-violet-500/10 text-violet-400",
  enterprise: "border-amber-500/30 bg-amber-500/10 text-amber-400",
};
const ROLE_STYLE: Record<string, string> = {
  owner:   "border-amber-500/30 bg-amber-500/10 text-amber-400",
  manager: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  member:  "border-slate-700 bg-slate-800 text-slate-400",
};

function exportCSV(users: User[]) {
  const headers = ["Name", "Email", "Platform Admin", "Organizations", "Joined"];
  const rows = users.map((u) => [
    u.name, u.email,
    u.isAdmin ? "Yes" : "No",
    u.memberships.map((m) => `${m.organization.name} (${m.role})`).join("; "),
    new Date(u.createdAt).toLocaleDateString(),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function UsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async (q = search, p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "25", page: String(p), search: q });
      const res = await apiGet<{ users: User[]; total: number }>(`/api/sadmin/users?${params}`);
      setUsers(res.users);
      setTotal(res.total);
    } finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { void load(); }, [load]);

  async function toggleAdmin(user: User) {
    const action = user.isAdmin ? "Revoke admin access" : "Grant admin access";
    const msg    = user.isAdmin
      ? `Remove platform admin access from ${user.name}?`
      : `Grant platform admin access to ${user.name}? They will be able to manage all organizations and users.`;
    if (!confirm(msg)) return;
    setToggling(user.id);
    try {
      await apiPatch(`/api/sadmin/users/${user.id}`, { isAdmin: !user.isAdmin });
      toast.success(`${action} — ${user.name}`);
      await load();
    } catch { toast.error("Update failed"); }
    finally { setToggling(null); }
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Users</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">{total} platform users total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV(users)} disabled={users.length === 0}
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

      <div className="relative w-64">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
        <Input placeholder="Search name or email…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); void load(search, 1); } }}
          className="pl-8 h-8 text-[12px] bg-slate-800 border-slate-700 text-slate-300 placeholder:text-slate-600 focus-visible:ring-cyan-500/30" />
      </div>

      <Card className="bg-slate-900/60 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {["User", "Platform Role", "Organizations", "Joined", "Actions"].map((h) => (
                    <TableHead key={h} className="text-[11px] font-medium text-slate-500 uppercase tracking-wider h-10">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-slate-800">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-slate-800 animate-pulse rounded w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow className="border-slate-800">
                    <TableCell colSpan={5} className="text-center text-slate-600 py-12 text-[13px]">No users found</TableCell>
                  </TableRow>
                ) : users.map((u) => (
                  <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0",
                          u.isAdmin ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
                        )}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-slate-200">{u.name}</p>
                          <p className="text-[11px] text-slate-600 font-mono">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.isAdmin ? (
                        <Badge variant="outline" className="text-[11px] border-cyan-500/30 bg-cyan-500/10 text-cyan-400 gap-1">
                          <Shield className="w-3 h-3" />
                          Platform Admin
                        </Badge>
                      ) : (
                        <span className="text-[12px] text-slate-600">Standard user</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {u.memberships.length === 0 ? (
                          <span className="text-[11px] text-slate-700">No orgs</span>
                        ) : u.memberships.map((m) => (
                          <div key={m.organization.id} className="flex items-center gap-1">
                            <span className="text-[12px] text-slate-400">{m.organization.name}</span>
                            <Badge variant="outline" className={cn("text-[10px] capitalize px-1 h-4", ROLE_STYLE[m.role] ?? "")}>
                              {m.role}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px] capitalize px-1 h-4", PLAN_STYLE[m.organization.plan] ?? "")}>
                              {m.organization.plan}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-[11px] text-slate-600">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => void toggleAdmin(u)}
                        disabled={toggling === u.id}
                        title={u.isAdmin ? "Revoke admin access" : "Grant admin access"}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all disabled:opacity-40",
                          u.isAdmin
                            ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                            : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/20"
                        )}>
                        {u.isAdmin
                          ? <><ShieldOff className="w-3 h-3" />Revoke</>
                          : <><Shield className="w-3 h-3" />Make Admin</>
                        }
                      </button>
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
