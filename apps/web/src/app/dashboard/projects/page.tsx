"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, FolderKanban, CheckSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type Stats = {
  totalProjects:    number;
  totalTasks:       number;
  projectsByStatus: { status: string; _count: { id: number } }[];
  tasksByStatus:    { status: string; _count: { id: number } }[];
};

type Project = {
  id: string; name: string; description: string | null; status: string;
  startDate: string | null; endDate: string | null; createdAt: string;
  _count: { tasks: number };
};

const STATUS_COLOR: Record<string, string> = {
  planning:  "bg-slate-100 text-slate-700",
  active:    "bg-blue-100 text-blue-700",
  on_hold:   "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  todo:        "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  review:      "bg-violet-100 text-violet-700",
  done:        "bg-emerald-100 text-emerald-700",
  cancelled:   "bg-red-100 text-red-700",
};

const STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"];

const EMPTY = { name: "", description: "", status: "planning", startDate: "", endDate: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function ProjectsOverviewPage() {
  const [stats, setStats]       = useState<Stats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Project | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiGet<Stats>("/api/projects/stats"),
      apiGet<{ projects: Project[] }>("/api/projects/projects?limit=50"),
    ])
      .then(([s, p]) => { setStats(s); setProjects(p.projects); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? "", status: p.status,
      startDate: p.startDate ? p.startDate.slice(0, 10) : "",
      endDate:   p.endDate   ? p.endDate.slice(0, 10)   : "",
    });
    setError(null); setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Project name is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name, status: form.status,
        description: form.description || undefined,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : undefined,
        endDate:   form.endDate   ? new Date(form.endDate).toISOString()   : undefined,
      };
      if (editing) await apiPatch(`/api/projects/projects/${editing.id}`, payload);
      else         await apiPost("/api/projects/projects", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { const msg = err instanceof Error ? err.message : "Save failed"; setError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/projects/projects/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} items? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${BASE_URL}/api/projects/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setProjects((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${selectedIds.size} items`);
    } catch { toast.error("Bulk delete failed"); }
    finally { setBulkDeleting(false); }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allSelected = projects.length > 0 && projects.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(projects.map((p) => p.id)));
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: stats?.totalProjects, icon: FolderKanban, color: "text-blue-500"    },
          { label: "Total Tasks",    value: stats?.totalTasks,    icon: CheckSquare,  color: "text-violet-500"  },
          { label: "Active",         value: stats?.projectsByStatus.find((s) => s.status === "active")?._count.id ?? 0, icon: FolderKanban, color: "text-emerald-500" },
          { label: "Done Tasks",     value: stats?.tasksByStatus.find((s) => s.status === "done")?._count.id ?? 0, icon: CheckSquare, color: "text-emerald-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Icon className={cn("w-4 h-4", color)} />
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? "—" : (value ?? 0).toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Tasks by Status</CardTitle>
              <Link href="/dashboard/projects/tasks" className="text-xs text-primary flex items-center gap-1 hover:underline">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? <div className="h-20 animate-pulse bg-muted rounded-lg" /> : (
              (stats?.tasksByStatus ?? []).map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", TASK_STATUS_COLOR[s.status] ?? "bg-muted")}>
                    {s.status.replace("_", " ")}
                  </span>
                  <Badge variant="secondary" className="font-mono">{s._count.id}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Projects list */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Projects</CardTitle>
              <Button size="sm" variant="outline" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />New</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <span className="text-sm font-medium">{selectedIds.size} selected</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="ml-auto flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {bulkDeleting ? "Deleting…" : "Delete selected"}
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="text-sm text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}
            {!loading && projects.length > 1 && (
              <div className="flex items-center gap-2 px-2 pb-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-input"
                  aria-label="Select all projects"
                />
                <span className="text-xs text-muted-foreground">Select all</span>
              </div>
            )}
            {loading ? <div className="h-32 animate-pulse bg-muted rounded-lg" /> : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No projects yet</p>
            ) : projects.map((p) => (
              <div key={p.id} className={cn("flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-muted/50 group", selectedIds.has(p.id) && "bg-primary/5")}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleRow(p.id)}
                  className="rounded border-input shrink-0"
                  aria-label={`Select ${p.name}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[p.status] ?? "bg-muted")}>
                    {p.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">{p._count.tasks} tasks</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Project" : "New Project"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <Field label="Project Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Website Redesign" /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date"><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="End Date"><Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
            </div>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Project"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
