"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, X, Download } from "lucide-react";
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
import { useCurrency, formatCurrency } from "@/lib/currency";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { exportCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;
const STORAGE_KEY = "filter_accounting_search";

type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  _deleted?: boolean;
};

type Invoice = {
  id: string; number: string; customerName: string; status: string;
  subtotal: number; tax: number; total: number; notes: string | null;
  issueDate: string; dueDate: string | null; paidDate: string | null;
  createdAt: string; _count: { items: number };
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  sent:      "bg-blue-100 text-blue-700",
  paid:      "bg-emerald-100 text-emerald-700",
  overdue:   "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];

const EMPTY_FORM = {
  number: "", customerName: "", status: "draft",
  tax: "0", notes: "", issueDate: "", dueDate: "",
};

const EMPTY_ITEM = { description: "", quantity: "1", unitPrice: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : "—"; }

export default function InvoicesPage() {
  const currency = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Invoice | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [newItem, setNewItem]   = useState(EMPTY_ITEM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState(() => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) ?? "" : ""));
  const [page, setPage]         = useState(1);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ invoices: Invoice[] }>("/api/accounting/invoices?limit=100")
      .then((d) => setInvoices(d.invoices))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, search);
  }, [search]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setLineItems([]);
    setNewItem(EMPTY_ITEM);
    setError(null);
    setOpen(true);
  }

  async function openEdit(inv: Invoice) {
    setEditing(inv);
    setForm({
      number: inv.number, customerName: inv.customerName, status: inv.status,
      tax: inv.tax.toString(), notes: inv.notes ?? "",
      issueDate: inv.issueDate ? inv.issueDate.slice(0, 10) : "",
      dueDate:   inv.dueDate   ? inv.dueDate.slice(0, 10)   : "",
    });
    setNewItem(EMPTY_ITEM);
    setError(null);
    setOpen(true);
    try {
      const { invoice } = await apiGet<{ invoice: Invoice & { items: LineItem[] } }>(`/api/accounting/invoices/${inv.id}`);
      setLineItems((invoice.items ?? []).map((i) => ({ ...i })));
    } catch { setLineItems([]); }
  }

  function setField(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }
  function setItemField(key: string, val: string) { setNewItem((i) => ({ ...i, [key]: val })); }

  const activeItems = lineItems.filter((i) => !i._deleted);
  const subtotal = activeItems.reduce((s, i) => s + i.amount, 0);
  const tax      = parseFloat(form.tax) || 0;
  const total    = subtotal + tax;

  function addItem() {
    const qty   = parseFloat(newItem.quantity) || 1;
    const price = parseFloat(newItem.unitPrice) || 0;
    if (!newItem.description.trim()) return;
    setLineItems((prev) => [...prev, {
      description: newItem.description, quantity: qty,
      unitPrice: price, amount: qty * price,
    }]);
    setNewItem(EMPTY_ITEM);
  }

  function removeItem(idx: number) {
    setLineItems((prev) => prev.map((item, i) =>
      i === idx ? (item.id ? { ...item, _deleted: true } : null!) : item
    ).filter(Boolean));
  }

  async function handleSave() {
    if (!form.number.trim())       { setError("Invoice number is required"); return; }
    if (!form.customerName.trim()) { setError("Customer name is required"); return; }
    setSaving(true); setError(null);
    try {
      const headerPayload = {
        number: form.number, customerName: form.customerName, status: form.status,
        subtotal, tax, total,
        notes:     form.notes     || undefined,
        issueDate: form.issueDate ? new Date(form.issueDate).toISOString() : undefined,
        dueDate:   form.dueDate   ? new Date(form.dueDate).toISOString()   : undefined,
      };

      let invoiceId: string;
      if (editing) {
        await apiPatch(`/api/accounting/invoices/${editing.id}`, headerPayload);
        invoiceId = editing.id;
      } else {
        const res = await apiPost<{ invoice: { id: string } }>("/api/accounting/invoices", headerPayload);
        invoiceId = res.invoice.id;
      }

      const deletions = lineItems.filter((i) => i._deleted && i.id).map((i) =>
        apiDelete(`/api/accounting/invoices/${invoiceId}/items/${i.id}`)
      );
      const additions = lineItems.filter((i) => !i._deleted && !i.id).map((i) =>
        apiPost(`/api/accounting/invoices/${invoiceId}/items`, {
          description: i.description, quantity: i.quantity,
          unitPrice: i.unitPrice, amount: i.amount,
        })
      );
      await Promise.all([...deletions, ...additions]);

      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/accounting/invoices/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} items? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${BASE_URL}/api/accounting/bulk`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Bulk delete failed");
      setInvoices((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      toast.success(`Deleted ${selectedIds.size} items`);
    } catch { toast.error("Bulk delete failed"); }
    finally { setBulkDeleting(false); }
  }

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    return inv.number.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q);
  });

  useEffect(() => { setPage(1); }, [search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allVisibleSelected = paginated.length > 0 && paginated.every((inv) => selectedIds.has(inv.id));

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((inv) => next.delete(inv.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginated.forEach((inv) => next.add(inv.id));
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
            placeholder="Search invoices…"
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
          <Button size="sm" variant="outline" onClick={() => exportCSV("invoices.csv",
            ["Number","Customer","Status","Subtotal","Tax","Total","Issue Date","Due Date"],
            filtered.map((inv) => [inv.number, inv.customerName, inv.status, inv.subtotal, inv.tax, inv.total, fmt(inv.issueDate), fmt(inv.dueDate)])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />New Invoice</Button>
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
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">{search ? "No matching invoices" : "No invoices yet"}</TableCell></TableRow>
            ) : paginated.map((inv) => (
              <TableRow key={inv.id} className={selectedIds.has(inv.id) ? "bg-primary/5" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inv.id)}
                    onChange={() => toggleRow(inv.id)}
                    className="rounded border-input"
                    aria-label={`Select ${inv.number}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">{inv.number}</TableCell>
                <TableCell>{inv.customerName}</TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[inv.status] ?? "bg-muted")}>{inv.status}</span>
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(inv.total, currency)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{inv._count.items} item{inv._count.items !== 1 ? "s" : ""}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmt(inv.issueDate)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmt(inv.dueDate)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(inv)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(inv.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xl">
          <SheetHeader><SheetTitle>{editing ? "Edit Invoice" : "New Invoice"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Invoice # *"><Input value={form.number} onChange={(e) => setField("number", e.target.value)} placeholder="INV-001" /></Field>
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => v && setField("status", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Customer Name *"><Input value={form.customerName} onChange={(e) => setField("customerName", e.target.value)} placeholder="Acme Corp" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Issue Date"><Input type="date" value={form.issueDate} onChange={(e) => setField("issueDate", e.target.value)} /></Field>
                <Field label="Due Date"><Input type="date" value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} /></Field>
              </div>
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => setField("notes", e.target.value)} rows={2} /></Field>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
              {activeItems.length > 0 && (
                <div className="rounded-md border mb-3 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Description</th>
                        <th className="text-right px-2 py-2 font-medium w-14">Qty</th>
                        <th className="text-right px-2 py-2 font-medium w-20">Price</th>
                        <th className="text-right px-2 py-2 font-medium w-20">Amount</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => item._deleted ? null : (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">{formatCurrency(item.unitPrice, currency)}</td>
                          <td className="px-2 py-2 text-right font-medium">{formatCurrency(item.amount, currency)}</td>
                          <td className="px-1 py-1">
                            <button onClick={() => removeItem(idx)} className="p-1 hover:text-destructive text-muted-foreground/50 transition-colors rounded">
                              <X className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Description</Label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Service or product…"
                    value={newItem.description}
                    onChange={(e) => setItemField("description", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                  />
                </div>
                <div className="w-14 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                  <Input className="h-8 text-xs" type="number" min="0" step="1" value={newItem.quantity} onChange={(e) => setItemField("quantity", e.target.value)} />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Unit Price</Label>
                  <Input className="h-8 text-xs" type="number" min="0" step="0.01" placeholder="0.00" value={newItem.unitPrice} onChange={(e) => setItemField("unitPrice", e.target.value)} />
                </div>
                <Button size="sm" variant="outline" onClick={addItem} className="h-8 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

            <div className="rounded-md bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span className="font-medium">{formatCurrency(subtotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Tax ({currency})</span>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.tax}
                  onChange={(e) => setField("tax", e.target.value)}
                  className="h-6 w-24 text-xs text-right"
                />
              </div>
              <div className="flex justify-between font-semibold border-t pt-1.5">
                <span>Total</span><span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Invoice"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
