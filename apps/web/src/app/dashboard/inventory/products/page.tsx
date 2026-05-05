"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Download, Boxes } from "lucide-react";
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { exportCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

type StockLevel = {
  id: string;
  quantity: number;
  minQuantity: number;
  warehouse: { id: string; name: string };
};

type Product = {
  id: string; name: string; sku: string; description: string | null;
  category: string | null; unitPrice: number | null; costPrice: number | null;
  unit: string; status: string; createdAt: string;
  stockLevels: StockLevel[];
};

const STATUS_COLOR: Record<string, string> = {
  active:       "bg-emerald-100 text-emerald-700",
  inactive:     "bg-slate-100 text-slate-700",
  discontinued: "bg-red-100 text-red-700",
};

const EMPTY = { name: "", sku: "", description: "", category: "", unitPrice: "", costPrice: "", unit: "unit", status: "active" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Product | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockForm, setStockForm]       = useState<Record<string, { quantity: string; minQuantity: string }>>({});
  const [stockSaving, setStockSaving]   = useState(false);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ products: Product[] }>("/api/inventory/products?limit=200")
      .then((d) => setProducts(d.products))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, description: p.description ?? "", category: p.category ?? "",
      unitPrice: p.unitPrice?.toString() ?? "", costPrice: p.costPrice?.toString() ?? "",
      unit: p.unit, status: p.status,
    });
    setError(null);
    setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.sku.trim())  { setError("SKU is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        unitPrice: form.unitPrice ? parseFloat(form.unitPrice) : undefined,
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      };
      if (editing) await apiPatch(`/api/inventory/products/${editing.id}`, payload);
      else         await apiPost("/api/inventory/products", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { const msg = err instanceof Error ? err.message : "Save failed"; setError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  function openStock(p: Product) {
    setStockProduct(p);
    const init: Record<string, { quantity: string; minQuantity: string }> = {};
    for (const sl of p.stockLevels) {
      init[sl.warehouse.id] = { quantity: sl.quantity.toString(), minQuantity: sl.minQuantity.toString() };
    }
    setStockForm(init);
  }

  async function handleStockSave() {
    if (!stockProduct) return;
    setStockSaving(true);
    try {
      await Promise.all(
        stockProduct.stockLevels.map((sl) => {
          const f = stockForm[sl.warehouse.id];
          if (!f) return Promise.resolve();
          return apiPost("/api/inventory/stock/adjust", {
            productId:   stockProduct.id,
            warehouseId: sl.warehouse.id,
            quantity:    parseFloat(f.quantity) || 0,
            minQuantity: parseFloat(f.minQuantity) || 0,
          });
        })
      );
      toast.success("Stock levels updated");
      setStockProduct(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setStockSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/inventory/products/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q);
  });

  useEffect(() => { setPage(1); }, [search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("products.csv",
            ["Name","SKU","Category","Status","Unit Price","Cost Price","Unit"],
            filtered.map((p) => [p.name, p.sku, p.category, p.status, p.unitPrice, p.costPrice, p.unit])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />Add Product</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{search ? "No matching products" : "No products yet"}</TableCell></TableRow>
            ) : paginated.map((p) => {
              const totalStock = (p.stockLevels ?? []).reduce((s, sl) => s + sl.quantity, 0);
              const lowStock   = (p.stockLevels ?? []).some((sl) => sl.quantity <= sl.minQuantity);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="text-muted-foreground">{p.category ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.unitPrice != null ? `$${p.unitPrice.toLocaleString()}` : "—"}</TableCell>
                  <TableCell>
                    {(p.stockLevels ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className={cn("text-xs font-medium", lowStock ? "text-amber-600" : "text-foreground")}>
                        {totalStock} {p.unit}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[p.status] ?? "bg-muted")}>{p.status}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(p.stockLevels ?? []).length > 0 && (
                        <Button variant="ghost" size="icon-sm" title="Manage stock" onClick={() => openStock(p)}>
                          <Boxes className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(p.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Product" : "New Product"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <Field label="Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Product name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SKU *"><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SKU-001" /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["active", "inactive", "discontinued"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category"><Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Electronics…" /></Field>
              <Field label="Unit"><Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="unit, kg, m…" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit Price ($)"><Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} placeholder="0.00" /></Field>
              <Field label="Cost Price ($)"><Input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="0.00" /></Field>
            </div>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Product"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />

      {/* Stock levels dialog */}
      <Dialog open={!!stockProduct} onOpenChange={(o) => { if (!o) setStockProduct(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stock Levels — {stockProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {(stockProduct?.stockLevels ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No stock records found.</p>
            ) : (
              <div className="space-y-3">
                {stockProduct?.stockLevels.map((sl) => {
                  const f = stockForm[sl.warehouse.id] ?? { quantity: sl.quantity.toString(), minQuantity: sl.minQuantity.toString() };
                  return (
                    <div key={sl.warehouse.id} className="rounded-lg border px-4 py-3 space-y-2">
                      <p className="text-sm font-medium">{sl.warehouse.name}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                          <Input
                            type="number" min="0" step="1"
                            value={f.quantity}
                            onChange={(e) => setStockForm((prev) => ({
                              ...prev,
                              [sl.warehouse.id]: { ...f, quantity: e.target.value },
                            }))}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Min Quantity</Label>
                          <Input
                            type="number" min="0" step="1"
                            value={f.minQuantity}
                            onChange={(e) => setStockForm((prev) => ({
                              ...prev,
                              [sl.warehouse.id]: { ...f, minQuantity: e.target.value },
                            }))}
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      {parseFloat(f.quantity) <= parseFloat(f.minQuantity) && parseFloat(f.minQuantity) > 0 && (
                        <p className="text-xs text-amber-600 font-medium">Low stock warning</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setStockProduct(null)}>Cancel</Button>
            <Button size="sm" onClick={handleStockSave} disabled={stockSaving}>
              {stockSaving ? "Saving…" : "Save Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
