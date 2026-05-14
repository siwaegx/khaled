"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Download, UserPlus, X } from "lucide-react";
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
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { exportCSV } from "@/lib/csv";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;
const STORAGE_KEY = "filter_crm_search";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  assignedTo: string | null;
  createdAt: string;
};

const STATUS_COLOR: Record<string, string> = {
  new:       "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  qualified: "bg-violet-100 text-violet-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost:      "bg-red-100 text-red-700",
};

const STATUSES = ["new", "contacted", "qualified", "converted", "lost"];

const EMPTY: Record<string, string> = {
  name: "", email: "", phone: "", company: "",
  status: "new", source: "", notes: "", assignedTo: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Lead | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();
  const [search, setSearch]     = useState(() => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) ?? "" : ""));
  const [page, setPage]         = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ leads: Lead[] }>("/api/crm/leads")
      .then((d) => setLeads(d.leads))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void (async () => { load(); })();
  }, [load]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, search);
  }, [search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setForm({
      name:       lead.name,
      email:      lead.email      ?? "",
      phone:      lead.phone      ?? "",
      company:    lead.company    ?? "",
      status:     lead.status,
      source:     lead.source     ?? "",
      notes:      lead.notes      ?? "",
      assignedTo: lead.assignedTo ?? "",
    });
    setError(null);
    setOpen(true);
  }

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, email: form.email || undefined };
      if (editing) {
        await apiPatch(`/api/crm/leads/${editing.id}`, payload);
      } else {
        await apiPost("/api/crm/leads", payload);
      }
      setOpen(false);
      toast.success(editing ? "Lead updated" : "Lead created");
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/crm/leads/${id}`); toast.success("Lead deleted"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleConvert(id: string) {
    try {
      await apiPost(`/api/crm/leads/${id}/convert`, {});
      toast.success("Lead converted to customer");
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Conversion failed"); }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} items? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${BASE_URL}/api/crm/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setLeads((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${selectedIds.size} items`);
    } catch { toast.error("Bulk delete failed"); }
    finally { setBulkDeleting(false); }
  }

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      (l.company ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => { setPage(1); }, [search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allVisibleSelected = paginated.length > 0 && paginated.every((l) => selectedIds.has(l.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((l) => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((l) => next.add(l.id));
        return next;
      });
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-xs">
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm pr-7"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("leads.csv",
            ["Name","Email","Phone","Company","Status","Source"],
            filtered.map((l) => [l.name, l.email, l.phone, l.company, l.status, l.source])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Lead
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-3">
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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-input"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {search ? "No matching leads" : "No leads yet — add your first one"}
                </TableCell>
              </TableRow>
            ) : paginated.map((lead) => (
              <TableRow key={lead.id} className={selectedIds.has(lead.id) ? "bg-primary/5" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={() => toggleRow(lead.id)}
                    className="rounded border-input"
                    aria-label={`Select ${lead.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{lead.name}</TableCell>
                <TableCell className="text-muted-foreground">{lead.company ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{lead.email ?? "—"}</TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[lead.status] ?? "bg-muted")}>
                    {lead.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">{lead.source ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {new Date(lead.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!["converted", "lost"].includes(lead.status) && (
                      <Button variant="ghost" size="icon-sm" title="Convert to customer" onClick={() => handleConvert(lead.id)}>
                        <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(lead)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(lead.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Lead" : "New Lead"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                {error}
              </p>
            )}
            <Field label="Name *">
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Company">
                <Input value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Inc." />
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v ?? "new")}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" />
              </Field>
            </div>
            <Field label="Source">
              <Input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Website, Referral, LinkedIn…" />
            </Field>
            <Field label="Assigned To">
              <Input value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} placeholder="User name or ID" />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any notes…" rows={3} />
            </Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Lead"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="Delete this lead? This cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
