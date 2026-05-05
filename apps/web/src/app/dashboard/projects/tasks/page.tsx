"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { exportCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type Task = {
  id: string; projectId: string | null; title: string; description: string | null;
  status: string; priority: string; assignedTo: string | null;
  dueDate: string | null; createdAt: string;
  project: { id: string; name: string } | null;
};

type Project = { id: string; name: string };

const STATUS_COLOR: Record<string, string> = {
  todo:        "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  review:      "bg-violet-100 text-violet-700",
  done:        "bg-emerald-100 text-emerald-700",
  cancelled:   "bg-red-100 text-red-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high:   "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const TASK_STATUSES = ["todo", "in_progress", "review", "done", "cancelled"];
const PRIORITIES    = ["low", "medium", "high", "urgent"];

const EMPTY = {
  projectId: "", title: "", description: "", status: "todo",
  priority: "medium", assignedTo: "", dueDate: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks]       = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Task | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiGet<{ tasks: Task[] }>("/api/projects/tasks?limit=100"),
      apiGet<{ projects: Project[] }>("/api/projects/projects?limit=100"),
    ])
      .then(([t, p]) => { setTasks(t.tasks); setProjects(p.projects); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      projectId: t.projectId ?? "", title: t.title, description: t.description ?? "",
      status: t.status, priority: t.priority, assignedTo: t.assignedTo ?? "",
      dueDate: t.dueDate ? t.dueDate.slice(0, 10) : "",
    });
    setError(null); setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        title: form.title, status: form.status, priority: form.priority,
        projectId:  form.projectId  || undefined,
        description: form.description || undefined,
        assignedTo:  form.assignedTo  || undefined,
        dueDate:     form.dueDate     ? new Date(form.dueDate).toISOString() : undefined,
      };
      if (editing) await apiPatch(`/api/projects/tasks/${editing.id}`, payload);
      else         await apiPost("/api/projects/tasks", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { const msg = err instanceof Error ? err.message : "Save failed"; setError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/projects/tasks/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  useEffect(() => { setPage(1); }, [search]);

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.project?.name ?? "").toLowerCase().includes(q);
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search tasks…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("tasks.csv",
            ["Title","Project","Status","Priority","Assigned To","Due Date"],
            filtered.map((t) => [t.title, t.project?.name, t.status, t.priority, t.assignedTo, t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ""])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />New Task</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{search ? "No matching tasks" : "No tasks yet"}</TableCell></TableRow>
            ) : paginated.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{t.project?.name ?? "—"}</TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[t.status] ?? "bg-muted")}>
                    {t.status.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", PRIORITY_COLOR[t.priority] ?? "bg-muted")}>{t.priority}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{t.assignedTo ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Task" : "New Task"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <Field label="Title *"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Task title" /></Field>
            <Field label="Project">
              <Select value={form.projectId || "_none"} onValueChange={(v) => set("projectId", v === "_none" ? "" : (v ?? ""))}>
                <SelectTrigger className="w-full h-9"><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No project</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={form.priority} onValueChange={(v) => v && set("priority", v)}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assigned To"><Input value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} placeholder="Name or ID" /></Field>
              <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
            </div>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Task"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
