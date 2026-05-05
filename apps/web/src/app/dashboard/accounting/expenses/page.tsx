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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { exportCSV } from "@/lib/csv";

const PAGE_SIZE = 20;

type Expense = {
  id: string; category: string; description: string; amount: number;
  currency: string; date: string; reference: string | null; notes: string | null;
  createdAt: string;
};

const EMPTY = { category: "", description: "", amount: "", currency: "USD", date: "", reference: "", notes: "" };

const CATEGORIES = ["Office", "Travel", "Software", "Hardware", "Marketing", "Payroll", "Utilities", "Rent", "Other"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Expense | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ expenses: Expense[] }>("/api/accounting/expenses?limit=100")
      .then((d) => setExpenses(d.expenses))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      category: e.category, description: e.description, amount: e.amount.toString(),
      currency: e.currency, date: e.date ? e.date.slice(0, 10) : "",
      reference: e.reference ?? "", notes: e.notes ?? "",
    });
    setError(null); setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.category.trim())    { setError("Category is required"); return; }
    if (!form.description.trim()) { setError("Description is required"); return; }
    if (!form.amount)             { setError("Amount is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        category: form.category, description: form.description,
        amount: parseFloat(form.amount), currency: form.currency || "USD",
        date:      form.date      ? new Date(form.date).toISOString() : undefined,
        reference: form.reference || undefined,
        notes:     form.notes     || undefined,
      };
      if (editing) await apiPatch(`/api/accounting/expenses/${editing.id}`, payload);
      else         await apiPost("/api/accounting/expenses", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { const msg = err instanceof Error ? err.message : "Save failed"; setError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/accounting/expenses/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  useEffect(() => { setPage(1); }, [search]);

  const filtered = expenses.filter((e) => {
    const q = search.toLowerCase();
    return e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search expenses…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("expenses.csv",
            ["Category","Description","Amount","Currency","Date","Reference"],
            filtered.map((e) => [e.category, e.description, e.amount, e.currency, e.date ? new Date(e.date).toLocaleDateString() : "", e.reference])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />Add Expense</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">{search ? "No matching expenses" : "No expenses yet"}</TableCell></TableRow>
            ) : paginated.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium capitalize">{e.category}</TableCell>
                <TableCell className="text-muted-foreground">{e.description}</TableCell>
                <TableCell className="font-medium">${e.amount.toLocaleString()} <span className="text-xs text-muted-foreground">{e.currency}</span></TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{e.reference ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Expense" : "New Expense"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category *">
                <Input list="categories" value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Travel, Office…" />
                <datalist id="categories">
                  {CATEGORIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="Amount ($) *"><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></Field>
            </div>
            <Field label="Description *"><Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Office supplies…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
              <Field label="Currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} placeholder="USD" /></Field>
            </div>
            <Field label="Reference"><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="Receipt #, PO #…" /></Field>
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Expense"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
