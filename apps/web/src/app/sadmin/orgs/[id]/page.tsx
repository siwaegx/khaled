"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Users, Package, Trash2, Calendar, Shield, ExternalLink, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Member = {
  id: string; role: string; joinedAt: string;
  user: { id: string; name: string; email: string; isAdmin: boolean };
};
type Module = { id: string; key: string; moduleKey: string; isActive: boolean; installedAt: string };
type Org = {
  id: string; name: string; slug: string; plan: string; status: string;
  trialEnds: string | null; createdAt: string; updatedAt: string;
  members: Member[]; modules: Module[];
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
const ROLE_STYLE: Record<string, string> = {
  owner:   "border-amber-500/30 bg-amber-500/10 text-amber-400",
  manager: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  member:  "border-slate-700 bg-slate-800 text-slate-400",
};

export default function OrgDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [org, setOrg]           = useState<Org | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]         = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [impersonating, setImpersonating] = useState(false);
  const [downloading, setDownloading]     = useState(false);
  const [trialDate, setTrialDate]         = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ organization: Org }>(`/api/sadmin/organizations/${id}`);
      setOrg(res.organization);
      if (res.organization.trialEnds) {
        setTrialDate(new Date(res.organization.trialEnds).toISOString().slice(0, 10));
      }
    } catch { toast.error("Failed to load organization"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function patch(data: Record<string, string>) {
    setSaving(true);
    try {
      await apiPatch(`/api/sadmin/organizations/${id}`, data);
      toast.success("Updated");
      await load();
    } catch { toast.error("Update failed"); }
    finally { setSaving(false); }
  }

  async function handleCancel() {
    if (!org) return;
    if (!confirm(`Cancel "${org.name}"? This sets status to cancelled.`)) return;
    setCancelling(true);
    try {
      await apiDelete(`/api/sadmin/organizations/${org.id}`);
      toast.success("Organization cancelled");
      router.push("/sadmin/orgs");
    } catch { toast.error("Failed to cancel"); }
    finally { setCancelling(false); }
  }

  async function handleTrialExtend() {
    if (!trialDate) return;
    await patch({ trialEnds: new Date(trialDate).toISOString() });
  }

  async function handleImpersonate() {
    if (!org) return;
    setImpersonating(true);
    try {
      await fetch(`${BASE_URL}/api/sadmin/organizations/${org.id}/impersonate`, {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/dashboard";
    } catch {
      toast.error("Failed to access dashboard");
      setImpersonating(false);
    }
  }

  async function handleDownloadBackup() {
    if (!org) return;
    setDownloading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/sadmin/organizations/${org.id}/backup`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Backup failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${org.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download backup");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 bg-slate-800 animate-pulse rounded-lg" />
          <div className="h-6 w-48 bg-slate-800 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 bg-slate-800 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <p className="text-[13px]">Organization not found.</p>
        <button onClick={() => router.push("/sadmin/orgs")} className="mt-4 text-[12px] text-cyan-400 hover:underline">
          ← Back to Organizations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/sadmin/orgs")}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold text-white">{org.name}</h1>
              <Badge variant="outline" className={cn("text-[11px] capitalize", STATUS_STYLE[org.status] ?? "")}>
                {org.status}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px] capitalize", PLAN_STYLE[org.plan] ?? "")}>
                {org.plan}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-600 font-mono mt-0.5">{org.slug} · {org.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => void handleDownloadBackup()} disabled={downloading}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-40">
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {downloading ? "Exporting…" : "Backup"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleImpersonate()} disabled={impersonating || org.status === "cancelled"}
            className="h-8 text-[12px] border-violet-700/40 bg-violet-900/10 text-violet-400 hover:bg-violet-900/30 hover:text-violet-300 disabled:opacity-40">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            {impersonating ? "Opening…" : "Access Dashboard"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700">
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleCancel()}
            disabled={cancelling || org.status === "cancelled"}
            className="h-8 text-[12px] border-red-800/40 bg-red-900/10 text-red-400 hover:bg-red-900/30 disabled:opacity-40">
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Cancel Org
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Plan */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">Plan</p>
            <Select value={org.plan} onValueChange={(v) => v && void patch({ plan: v })} disabled={saving}>
              <SelectTrigger className="h-8 text-[12px] bg-slate-800 border-slate-700 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {["starter", "growth", "pro", "enterprise"].map((p) => (
                  <SelectItem key={p} value={p} className="text-[12px] capitalize text-slate-300">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Status */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5">Status</p>
            <Select value={org.status} onValueChange={(v) => v && void patch({ status: v })} disabled={saving}>
              <SelectTrigger className="h-8 text-[12px] bg-slate-800 border-slate-700 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {["trial", "active", "suspended", "cancelled"].map((s) => (
                  <SelectItem key={s} value={s} className="text-[12px] capitalize text-slate-300">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Trial End Date */}
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="p-4">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              Trial End Date
            </p>
            <div className="flex gap-2">
              <input
                type="date"
                value={trialDate}
                onChange={(e) => setTrialDate(e.target.value)}
                disabled={saving}
                className="flex-1 h-8 px-2.5 text-[12px] rounded-lg bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 [color-scheme:dark]"
              />
              <button
                onClick={() => void handleTrialExtend()}
                disabled={saving || !trialDate}
                className="px-2.5 h-8 rounded-lg text-[11px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/25 transition-colors disabled:opacity-40">
                Set
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-6 text-[12px] text-slate-500 px-1">
        <span>Created <span className="text-slate-400">{new Date(org.createdAt).toLocaleDateString()}</span></span>
        <span>Updated <span className="text-slate-400">{new Date(org.updatedAt).toLocaleDateString()}</span></span>
        {org.trialEnds && (
          <span>Trial ends <span className="text-amber-400 font-medium">{new Date(org.trialEnds).toLocaleDateString()}</span></span>
        )}
        <span><span className="text-slate-400">{org.members.length}</span> member{org.members.length !== 1 ? "s" : ""}</span>
        <span><span className="text-slate-400">{org.modules.length}</span> module{org.modules.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Members */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Members
            <span className="text-[11px] font-normal text-slate-600 ml-1">{org.members.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                {["Name", "Email", "Role", "Joined"].map((h) => (
                  <TableHead key={h} className="text-[11px] font-medium text-slate-500 uppercase tracking-wider h-9 px-5">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {org.members.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={4} className="text-center text-slate-600 py-8 text-[12px]">No members</TableCell>
                </TableRow>
              ) : org.members.map((m) => (
                <TableRow key={m.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <TableCell className="px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium text-slate-200">{m.user.name}</span>
                      {m.user.isAdmin && <span title="Platform Admin"><Shield className="w-3 h-3 text-cyan-400" /></span>}
                    </div>
                  </TableCell>
                  <TableCell className="px-5 text-[12px] text-slate-500 font-mono">{m.user.email}</TableCell>
                  <TableCell className="px-5">
                    <Badge variant="outline" className={cn("text-[11px] capitalize", ROLE_STYLE[m.role] ?? "")}>
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-5 text-[11px] text-slate-600">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modules */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-400" />
            Installed Modules
            <span className="text-[11px] font-normal text-slate-600 ml-1">{org.modules.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {org.modules.length === 0 ? (
            <p className="text-center text-slate-600 py-8 text-[12px]">No modules installed</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  {["Module Key", "Installed", "Status"].map((h) => (
                    <TableHead key={h} className="text-[11px] font-medium text-slate-500 uppercase tracking-wider h-9 px-5">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {org.modules.map((mod) => (
                  <TableRow key={mod.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <TableCell className="px-5 text-[13px] font-mono text-slate-300">{mod.moduleKey}</TableCell>
                    <TableCell className="px-5 text-[11px] text-slate-600">
                      {new Date(mod.installedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-5">
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border",
                        mod.isActive
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                          : "text-slate-500 bg-slate-800 border-slate-700")}>
                        {mod.isActive ? "Active" : "Inactive"}
                      </span>
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
