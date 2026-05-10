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
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { exportCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

type OrderItem = {
  id?: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  _deleted?: boolean;
};

type Order = {
  id: string; supplierName: string; status: string;
  totalAmount: number | null; notes: string | null;
  orderDate: string | null; expectedDate: string | null;
  createdAt: string; _count: { items: number };
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-slate-100 text-slate-700",
  ordered:   "bg-blue-100 text-blue-700",
  partial:   "bg-amber-100 text-amber-700",
  received:  "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

const STATUSES = ["draft", "ordered", "partial", "received", "cancelled"];

const EMPTY = { supplierName: "", status: "draft", notes: "", orderDate: "", expectedDate: "" };
const EMPTY_ITEM = { productName: "", quantity: "1", unitCost: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString() : "—"; }

export default function OrdersPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Order | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [lineItems, setLineItems] = useState<OrderItem[]>([]);
  const [newItem, setNewItem]   = useState(EMPTY_ITEM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ orders: Order[] }>("/api/inventory/orders?limit=100")
      .then((d) => setOrders(d.orders))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null); setForm(EMPTY); setLineItems([]);
    setNewItem(EMPTY_ITEM); setError(null); setOpen(true);
  }

  async function openEdit(o: Order) {
    setEditing(o);
    setForm({
      supplierName: o.supplierName, status: o.status,
      notes:        o.notes ?? "",
      orderDate:    o.orderDate    ? o.orderDate.slice(0, 10)    : "",
      expectedDate: o.expectedDate ? o.expectedDate.slice(0, 10) : "",
    });
    setNewItem(EMPTY_ITEM); setError(null); setOpen(true);
    try {
      const { order } = await apiGet<{ order: Order & { items: OrderItem[] } }>(`/api/inventory/orders/${o.id}`);
      setLineItems((order.items ?? []).map((i) => ({ ...i })));
    } catch { setLineItems([]); }
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }
  function setItemField(key: string, val: string) { setNewItem((i) => ({ ...i, [key]: val })); }

  const activeItems = lineItems.filter((i) => !i._deleted);
  const subtotal    = activeItems.reduce((s, i) => s + i.totalCost, 0);

  function addItem() {
    const qty  = parseFloat(newItem.quantity) || 1;
    const cost = parseFloat(newItem.unitCost) || 0;
    if (!newItem.productName.trim()) return;
    setLineItems((prev) => [...prev, {
      productName: newItem.productName, quantity: qty,
      unitCost: cost, totalCost: qty * cost,
    }]);
    setNewItem(EMPTY_ITEM);
  }

  function removeItem(idx: number) {
    setLineItems((prev) => prev.map((item, i) =>
      i === idx ? (item.id ? { ...item, _deleted: true } : null!) : item
    ).filter(Boolean));
  }

  async function handleSave() {
    if (!form.supplierName.trim()) { setError("Supplier name is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        supplierName: form.supplierName, status: form.status,
        totalAmount:  subtotal || undefined,
        notes:        form.notes        || undefined,
        orderDate:    form.orderDate    ? new Date(form.orderDate).toISOString()    : undefined,
        expectedDate: form.expectedDate ? new Date(form.expectedDate).toISOString() : undefined,
      };

      let orderId: string;
      if (editing) {
        await apiPatch(`/api/inventory/orders/${editing.id}`, payload);
        orderId = editing.id;
      } else {
        const res = await apiPost<{ order: { id: string } }>("/api/inventory/orders", payload);
        orderId = res.order.id;
      }

      const deletions = lineItems.filter((i) => i._deleted && i.id).map((i) =>
        apiDelete(`/api/inventory/orders/${orderId}/items/${i.id}`)
      );
      const additions = lineItems.filter((i) => !i._deleted && !i.id).map((i) =>
        apiPost(`/api/inventory/orders/${orderId}/items`, {
          productName: i.productName, quantity: i.quantity,
          unitCost: i.unitCost, totalCost: i.totalCost,
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
    try { await apiDelete(`/api/inventory/orders/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return o.supplierName.toLowerCase().includes(q) || o.status.toLowerCase().includes(q);
  });

  useEffect(() => { setPage(1); }, [search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search orders…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("purchase-orders.csv",
            ["Supplier","Status","Total","Order Date","Expected Date","Items"],
            filtered.map((o) => [o.supplierName, o.status, o.totalAmount, fmt(o.orderDate), fmt(o.expectedDate), o._count.items])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />New Order</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{search ? "No matching orders" : "No orders yet"}</TableCell></TableRow>
            ) : paginated.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.supplierName}</TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[o.status] ?? "bg-muted")}>{o.status}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{o.totalAmount != null ? `$${o.totalAmount.toLocaleString()}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmt(o.orderDate)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmt(o.expectedDate)}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{o._count.items}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(o)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(o.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
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
          <SheetHeader><SheetTitle>{editing ? "Edit Order" : "New Purchase Order"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-5">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <Field label="Supplier Name *"><Input value={form.supplierName} onChange={(e) => set("supplierName", e.target.value)} placeholder="Supplier Co." /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Order Date"><Input type="date" value={form.orderDate} onChange={(e) => set("orderDate", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Expected Date"><Input type="date" value={form.expectedDate} onChange={(e) => set("expectedDate", e.target.value)} /></Field>
              </div>
              <Field label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></Field>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
              {activeItems.length > 0 && (
                <div className="rounded-md border mb-3 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Product</th>
                        <th className="text-right px-2 py-2 font-medium w-14">Qty</th>
                        <th className="text-right px-2 py-2 font-medium w-20">Unit Cost</th>
                        <th className="text-right px-2 py-2 font-medium w-20">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, idx) => item._deleted ? null : (
                        <tr key={idx} className="border-t">
                          <td className="px-3 py-2">{item.productName}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">${item.unitCost.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-medium">${item.totalCost.toFixed(2)}</td>
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
                  <Label className="text-[10px] text-muted-foreground">Product Name</Label>
                  <Input
                    className="h-8 text-xs" placeholder="Product…"
                    value={newItem.productName}
                    onChange={(e) => setItemField("productName", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                  />
                </div>
                <div className="w-14 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                  <Input className="h-8 text-xs" type="number" min="0" step="1" value={newItem.quantity} onChange={(e) => setItemField("quantity", e.target.value)} />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Unit Cost</Label>
                  <Input className="h-8 text-xs" type="number" min="0" step="0.01" placeholder="0.00" value={newItem.unitCost} onChange={(e) => setItemField("unitCost", e.target.value)} />
                </div>
                <Button size="sm" variant="outline" onClick={addItem} className="h-8 shrink-0"><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            </div>

            {activeItems.length > 0 && (
              <div className="rounded-md bg-muted/40 px-4 py-3 flex justify-between text-sm font-semibold">
                <span>Total</span><span>${subtotal.toFixed(2)}</span>
              </div>
            )}
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Order"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
