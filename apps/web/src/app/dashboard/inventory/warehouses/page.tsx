"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";

type WarehouseItem = {
  id: string; name: string; location: string | null; description: string | null;
  createdAt: string; _count: { stockLevels: number };
};

const EMPTY = { name: "", location: "", description: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [open, setOpen]             = useState(false);
  const [editing, setEditing]       = useState<WarehouseItem | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ warehouses: WarehouseItem[] }>("/api/inventory/warehouses")
      .then((d) => setWarehouses(d.warehouses))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(w: WarehouseItem) {
    setEditing(w);
    setForm({ name: w.name, location: w.location ?? "", description: w.description ?? "" });
    setError(null); setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = { name: form.name, location: form.location || undefined, description: form.description || undefined };
      if (editing) await apiPatch(`/api/inventory/warehouses/${editing.id}`, payload);
      else         await apiPost("/api/inventory/warehouses", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed"); toast.error(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/inventory/warehouses/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <div className="ml-auto">
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />Add Warehouse</Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse bg-muted rounded-lg" />)}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No warehouses yet — add your first one</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <Card key={w.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-violet-500" />
                    <CardTitle className="text-sm font-semibold">{w.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(w)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(w.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {w.location && <p className="text-xs text-muted-foreground">{w.location}</p>}
                {w.description && <p className="text-xs text-muted-foreground">{w.description}</p>}
                <p className="text-xs font-medium mt-2">{w._count.stockLevels} product{w._count.stockLevels !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Warehouse" : "New Warehouse"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <Field label="Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Warehouse" /></Field>
            <Field label="Location"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="123 Industrial Ave, City" /></Field>
            <Field label="Description"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Create Warehouse"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
