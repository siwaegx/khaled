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
import { exportCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

type Deal = { id: string; title: string; status: string; value: number | null };

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  deals: Deal[];
};

const DEAL_STATUS_COLOR: Record<string, string> = {
  prospect:    "bg-slate-100 text-slate-700",
  qualified:   "bg-blue-100 text-blue-700",
  proposal:    "bg-violet-100 text-violet-700",
  negotiation: "bg-amber-100 text-amber-700",
  won:         "bg-emerald-100 text-emerald-700",
  lost:        "bg-red-100 text-red-700",
};

const EMPTY: Record<string, string> = {
  name: "", email: "", phone: "", company: "", address: "", notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<Customer | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ customers: Customer[] }>("/api/crm/customers")
      .then((d) => setCustomers(d.customers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void (async () => { load(); })();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name:    c.name,
      email:   c.email   ?? "",
      phone:   c.phone   ?? "",
      company: c.company ?? "",
      address: c.address ?? "",
      notes:   c.notes   ?? "",
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
        await apiPatch(`/api/crm/customers/${editing.id}`, payload);
      } else {
        await apiPost("/api/crm/customers", payload);
      }
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
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
    try { await apiDelete(`/api/crm/customers/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  useEffect(() => { setPage(1); }, [search]);

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("customers.csv",
            ["Name","Email","Phone","Company"],
            filtered.map((c) => [c.name, c.email, c.phone, c.company])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Customer
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Deals</TableHead>
              <TableHead>Since</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  {search ? "No matching customers" : "No customers yet — add your first one"}
                </TableCell>
              </TableRow>
            ) : paginated.map((c) => {
              const activeDeals = c.deals.filter((d) => !["won", "lost"].includes(d.status));
              const wonDeals    = c.deals.filter((d) => d.status === "won");
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.company ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 flex-wrap">
                      {c.deals.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <>
                          {activeDeals.length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                              {activeDeals.length} active
                            </span>
                          )}
                          {wonDeals.length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                              {wonDeals.length} won
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      {/* deals panel shown when editing */}
      {editing && editing.deals.length > 0 && open && (
        <div className="hidden" />
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Customer" : "New Customer"}</SheetTitle>
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
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, City" />
            </Field>
            <Field label="Notes">
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any notes…" rows={3} />
            </Field>

            {editing && editing.deals.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Associated Deals</p>
                {editing.deals.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between text-xs py-1">
                    <span className="font-medium truncate max-w-[140px]">{deal.title}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {deal.value != null && (
                        <span className="text-muted-foreground">${deal.value.toLocaleString()}</span>
                      )}
                      <span className={cn("px-1.5 py-0.5 rounded-full font-medium capitalize", DEAL_STATUS_COLOR[deal.status] ?? "bg-muted")}>
                        {deal.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Customer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
