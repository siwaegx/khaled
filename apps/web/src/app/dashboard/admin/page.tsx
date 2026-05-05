"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Building2, Users, TrendingUp, DollarSign,
  Shield, CheckCircle2, XCircle, AlertCircle, Search, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";

type AdminStats = {
  totalOrgs: number;
  totalUsers: number;
  orgsByPlan: { plan: string; _count: { id: number } }[];
  orgsByStatus: { status: string; _count: { id: number } }[];
};

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  userCount: number;
  createdAt: string;
  _count: { members: number; modules: number };
};

type Plan = {
  plan: string;
  count: number;
  pricePerMonth: number;
  mrr: number;
};

const STATUS_BADGE: Record<string, string> = {
  trial:     "border-amber-200 bg-amber-50 text-amber-700",
  active:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  suspended: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

const PLAN_BADGE: Record<string, string> = {
  starter:    "border-emerald-200 bg-emerald-50 text-emerald-700",
  growth:     "border-blue-200 bg-blue-50 text-blue-700",
  pro:        "border-violet-200 bg-violet-50 text-violet-700",
  enterprise: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function AdminPage() {
  const { role } = useAuth();
  const router = useRouter();

  const [stats, setStats]   = useState<AdminStats | null>(null);
  const [orgs, setOrgs]     = useState<Org[]>([]);
  const [plans, setPlans]   = useState<Plan[]>([]);
  const [totalMrr, setTotalMrr] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // Guard: only owner role may access admin panel
  useEffect(() => {
    if (role && role !== "owner") router.replace("/dashboard");
  }, [role, router]);

  const load = useCallback(async (q = search) => {
    setLoading(true);
    setError(null);
    try {
      const [s, o, p] = await Promise.all([
        apiGet<AdminStats>("/api/admin/stats"),
        apiGet<{ organizations: Org[] }>(`/api/admin/organizations?limit=50&search=${encodeURIComponent(q)}`),
        apiGet<{ plans: Plan[]; totalMrr: number }>("/api/admin/plans"),
      ]);
      setStats(s);
      setOrgs(o.organizations);
      setPlans(p.plans);
      setTotalMrr(p.totalMrr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  async function handlePlanChange(orgId: string, newPlan: string) {
    setUpdating(orgId);
    try {
      await apiPatch(`/api/admin/organizations/${orgId}`, { plan: newPlan });
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  async function handleStatusChange(orgId: string, newStatus: string) {
    setUpdating(orgId);
    try {
      await apiPatch(`/api/admin/organizations/${orgId}`, { status: newStatus });
      await load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  if (role && role !== "owner") return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          </div>
          <p className="text-sm text-muted-foreground">Platform-wide management — organizations, users, and billing.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Organizations", value: stats?.totalOrgs, icon: Building2, color: "text-blue-500" },
          { label: "Total Users",          value: stats?.totalUsers, icon: Users,     color: "text-violet-500" },
          { label: "Active Plans",          value: plans.reduce((s, p) => s + p.count, 0), icon: TrendingUp, color: "text-emerald-500" },
          { label: "Est. MRR",              value: `$${totalMrr.toLocaleString()}`, icon: DollarSign, color: "text-amber-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Icon className={cn("w-4 h-4", color)} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? "—" : String(value ?? 0)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Plan revenue breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-24 animate-pulse bg-muted rounded-lg" />
            ) : plans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active plans</p>
            ) : plans.map((p) => (
              <div key={p.plan} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs capitalize", PLAN_BADGE[p.plan] ?? "")}>
                    {p.plan}
                  </Badge>
                  <span className="text-muted-foreground">{p.count} org{p.count !== 1 ? "s" : ""}</span>
                </div>
                <span className="font-medium">${p.mrr.toLocaleString()}/mo</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Organization Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="h-24 animate-pulse bg-muted rounded-lg" />
            ) : (stats?.orgsByStatus ?? []).map((row) => (
              <div key={row.status} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  {row.status === "active" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  {row.status === "trial" && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                  {row.status === "suspended" && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  {row.status === "cancelled" && <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                  <Badge variant="outline" className={cn("text-xs capitalize", STATUS_BADGE[row.status] ?? "")}>
                    {row.status}
                  </Badge>
                </div>
                <span className="font-medium">{row._count.id}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Organizations table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold">Organizations</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search orgs…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void load(search)}
                className="pl-8 h-8 text-xs w-56"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Organization</TableHead>
                  <TableHead className="text-xs">Plan</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Members</TableHead>
                  <TableHead className="text-xs">Modules</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : orgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : orgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{org.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={org.plan}
                        onValueChange={(v) => v && void handlePlanChange(org.id, v)}
                        disabled={updating === org.id}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["starter", "growth", "pro", "enterprise"].map((p) => (
                            <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={org.status}
                        onValueChange={(v) => v && void handleStatusChange(org.id, v)}
                        disabled={updating === org.id}
                      >
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["trial", "active", "suspended", "cancelled"].map((s) => (
                            <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{org._count.members}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{org._count.modules}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn("text-xs capitalize cursor-default", STATUS_BADGE[org.status] ?? "")}
                      >
                        {org.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
