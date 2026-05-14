"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
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
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { useCurrency, formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string; industry: string | null };

type Deal = {
  id: string;
  title: string;
  value: number | null;
  currency: string;
  status: string;
  companyId: string | null;
  company: Company | null;
  assignedTo: string | null;
  closeDate: string | null;
  notes: string | null;
  createdAt: string;
};

const COLUMNS = [
  { key: "prospect",    label: "Prospect",    color: "border-slate-200 bg-slate-50",   badge: "bg-slate-100 text-slate-700" },
  { key: "qualified",   label: "Qualified",   color: "border-blue-200 bg-blue-50",     badge: "bg-blue-100 text-blue-700" },
  { key: "proposal",    label: "Proposal",    color: "border-violet-200 bg-violet-50", badge: "bg-violet-100 text-violet-700" },
  { key: "negotiation", label: "Negotiation", color: "border-amber-200 bg-amber-50",   badge: "bg-amber-100 text-amber-700" },
  { key: "won",         label: "Won",         color: "border-emerald-200 bg-emerald-50", badge: "bg-emerald-100 text-emerald-700" },
  { key: "lost",        label: "Lost",        color: "border-red-200 bg-red-50",       badge: "bg-red-100 text-red-700" },
];

const DEAL_STATUSES = COLUMNS.map((c) => c.key);

const EMPTY_BASE: Record<string, string> = {
  title: "", value: "", status: "prospect",
  companyId: "", assignedTo: "", closeDate: "", notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function DealsPage() {
  const currency = useCurrency();
  const [deals, setDeals]       = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Deal | null>(null);
  const [form, setForm]         = useState<Record<string, string>>({ ...EMPTY_BASE, currency });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  async function handleDrop(e: React.DragEvent, targetStatus: string) {
    e.preventDefault();
    setDragOver(null);
    const dealId     = e.dataTransfer.getData("dealId");
    const fromStatus = e.dataTransfer.getData("fromStatus");
    if (!dealId || fromStatus === targetStatus) return;
    setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status: targetStatus } : d));
    try {
      await apiPatch(`/api/crm/deals/${dealId}`, { status: targetStatus });
    } catch {
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, status: fromStatus } : d));
    }
  }

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiGet<{ deals: Deal[] }>("/api/crm/deals"),
      apiGet<{ customers: Company[] }>("/api/crm/customers"),
    ])
      .then(([d, c]) => { setDeals(d.deals); setCompanies(c.customers); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void (async () => { load(); })();
  }, [load]);

  function openCreate(status = "prospect") {
    setEditing(null);
    setForm({ ...EMPTY_BASE, currency, status });
    setError(null);
    setOpen(true);
  }

  function openEdit(deal: Deal) {
    setEditing(deal);
    setForm({
      title:      deal.title,
      value:      deal.value != null ? String(deal.value) : "",
      currency:   deal.currency,
      status:     deal.status,
      companyId: deal.companyId ?? "",
      assignedTo: deal.assignedTo ?? "",
      closeDate:  deal.closeDate ? deal.closeDate.slice(0, 10) : "",
      notes:      deal.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title:      form.title,
        value:      form.value !== "" ? parseFloat(form.value) : undefined,
        currency:   form.currency,
        status:     form.status,
        companyId: form.companyId || undefined,
        assignedTo: form.assignedTo || undefined,
        closeDate:  form.closeDate ? new Date(form.closeDate).toISOString() : undefined,
        notes:      form.notes || undefined,
      };
      if (editing) {
        await apiPatch(`/api/crm/deals/${editing.id}`, payload);
      } else {
        await apiPost("/api/crm/deals", payload);
      }
      setOpen(false);
      toast.success(editing ? "Deal updated" : "Deal created");
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
    try { await apiDelete(`/api/crm/deals/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {deals.length} deal{deals.length !== 1 ? "s" : ""} in pipeline
        </p>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Deal
        </Button>
      </div>

      {loading ? (
        <div className="h-40 rounded-xl bg-muted animate-pulse" />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
          {COLUMNS.map((col) => {
            const colDeals = deals.filter((d) => d.status === col.key);
            const total = colDeals.reduce((s, d) => s + (d.value ?? 0), 0);

            return (
              <div
                key={col.key}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3 min-w-[220px] w-[220px] shrink-0 transition-colors",
                  dragOver === col.key ? "ring-2 ring-primary/40 border-primary/30" : col.color
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.key); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", col.badge)}>
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{colDeals.length}</span>
                  </div>
                  {total > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {formatCurrency(total, currency)}
                    </span>
                  )}
                </div>

                {colDeals.map((deal) => (
                  <button
                    key={deal.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("dealId", deal.id);
                      e.dataTransfer.setData("fromStatus", deal.status);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onClick={() => openEdit(deal)}
                    className="text-left rounded-lg bg-background border border-border/60 p-3 shadow-xs hover:border-border hover:shadow-sm transition-all space-y-1.5 group cursor-grab active:cursor-grabbing"
                  >
                    <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                      {deal.title}
                    </p>
                    {deal.company && (
                      <p className="text-xs text-muted-foreground truncate">
                        {deal.company.name}
                        {deal.company.industry ? ` · ${deal.company.industry}` : ""}
                      </p>
                    )}
                    {deal.value != null && (
                      <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        {formatCurrency(deal.value, currency)}
                      </div>
                    )}
                    {deal.closeDate && (
                      <p className="text-xs text-muted-foreground">
                        Close: {new Date(deal.closeDate).toLocaleDateString()}
                      </p>
                    )}
                  </button>
                ))}

                <button
                  onClick={() => openCreate(col.key)}
                  className="mt-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add deal
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Deal" : "New Deal"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                {error}
              </p>
            )}
            <Field label="Title *">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Deal title" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Currency">
                <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} placeholder="USD" />
              </Field>
            </div>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v ?? "prospect")}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEAL_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Company">
              <Select value={form.companyId || "__none__"} onValueChange={(v) => set("companyId", !v || v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.industry ? ` (${c.industry})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Close Date">
              <Input type="date" value={form.closeDate} onChange={(e) => set("closeDate", e.target.value)} />
            </Field>
            <Field label="Assigned To">
              <Input value={form.assignedTo} onChange={(e) => set("assignedTo", e.target.value)} placeholder="User name or ID" />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any notes…" rows={3} />
            </Field>
            {editing && (
              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={async () => { await handleDelete(editing.id); setOpen(false); }}
                >
                  Delete Deal
                </Button>
              </div>
            )}
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Deal"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
