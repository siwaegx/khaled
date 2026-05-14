"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, Download, Users, TrendingUp,
  Phone, Mail, Building2, ClipboardList, DollarSign, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
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

type Deal = {
  id: string;
  title: string;
  status: string;
  value: number | null;
  currency: string;
};

type Contact = {
  id: string;
  companyId: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
};

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  contacts: Contact[];
  deals: Deal[];
};

type CompanyLog = {
  id: string;
  companyId: string;
  type: "call" | "visit" | "email" | "note" | "other";
  subject: string | null;
  body: string | null;
  loggedAt: string;
  createdAt: string;
};

const LOG_LABELS: Record<string, string> = {
  call: "Call", visit: "Visit", email: "Email", note: "Note", other: "Other",
};
const LOG_EMOJIS: Record<string, string> = {
  call: "📞", visit: "🏢", email: "📧", note: "📝", other: "💬",
};
const LOG_COLORS: Record<string, string> = {
  call:  "border-emerald-200 bg-emerald-50 text-emerald-700",
  visit: "border-blue-200 bg-blue-50 text-blue-700",
  email: "border-violet-200 bg-violet-50 text-violet-700",
  note:  "border-amber-200 bg-amber-50 text-amber-700",
  other: "border-slate-200 bg-slate-50 text-slate-700",
};

const DEAL_STATUS_COLOR: Record<string, string> = {
  prospect:    "bg-slate-100 text-slate-700",
  qualified:   "bg-blue-100 text-blue-700",
  proposal:    "bg-violet-100 text-violet-700",
  negotiation: "bg-amber-100 text-amber-700",
  won:         "bg-emerald-100 text-emerald-700",
  lost:        "bg-red-100 text-red-700",
};

const CUSTOMER_EMPTY = {
  name: "", email: "", phone: "", industry: "", website: "", address: "", notes: "",
};
const DEAL_EMPTY_BASE = { title: "", value: "", status: "prospect", closeDate: "" };
const LOG_EMPTY = { type: "note", subject: "", body: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
      {initials}
    </div>
  );
}

export default function CustomersPage() {
  const currency = useCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);

  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);
  const [editingCustomer, setEditingCustomer]     = useState<Customer | null>(null);
  const [customerForm, setCustomerForm]           = useState(CUSTOMER_EMPTY);
  const [customerSaving, setCustomerSaving]       = useState(false);
  const [customerError, setCustomerError]         = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected]     = useState<Customer | null>(null);

  const [logs, setLogs]               = useState<CompanyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [addingLog, setAddingLog]     = useState(false);
  const [logForm, setLogForm]         = useState(LOG_EMPTY);
  const [logSaving, setLogSaving]     = useState(false);
  const [logError, setLogError]       = useState<string | null>(null);

  const [addingDeal, setAddingDeal] = useState(false);
  const [dealForm, setDealForm]     = useState<Record<string, string>>({ ...DEAL_EMPTY_BASE, currency });
  const [dealSaving, setDealSaving] = useState(false);
  const [dealError, setDealError]   = useState<string | null>(null);

  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ customers: Customer[] }>("/api/crm/customers")
      .then((cd) => setCustomers(cd.customers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  function loadLogs(customer: Customer) {
    setLogsLoading(true);
    apiGet<{ logs: CompanyLog[] }>(`/api/contacts/companies/${customer.id}/logs`)
      .then((d) => setLogs(d.logs))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }

  function openDetail(customer: Customer) {
    setSelected(customer);
    setDetailOpen(true);
    setAddingLog(false);
    setAddingDeal(false);
    setLogForm(LOG_EMPTY);
    setDealForm({ ...DEAL_EMPTY_BASE, currency });
    setLogError(null);
    setDealError(null);
    loadLogs(customer);
  }

  function closeDetail() {
    setDetailOpen(false);
    setAddingLog(false);
    setAddingDeal(false);
  }

  function openCreate() {
    setEditingCustomer(null);
    setCustomerForm(CUSTOMER_EMPTY);
    setCustomerError(null);
    setCustomerSheetOpen(true);
  }

  function openEdit(c: Customer) {
    setEditingCustomer(c);
    setCustomerForm({
      name:     c.name,
      email:    c.email    ?? "",
      phone:    c.phone    ?? "",
      industry: c.industry ?? "",
      website:  c.website  ?? "",
      address:  c.address  ?? "",
      notes:    c.notes    ?? "",
    });
    setCustomerError(null);
    setCustomerSheetOpen(true);
  }

  async function handleSaveCustomer() {
    if (!customerForm.name.trim()) { setCustomerError("Name is required"); return; }
    setCustomerSaving(true); setCustomerError(null);
    try {
      const payload = { ...customerForm, email: customerForm.email || undefined };
      if (editingCustomer) {
        await apiPatch(`/api/crm/customers/${editingCustomer.id}`, payload);
        toast.success("Saved successfully");
      } else {
        await apiPost("/api/crm/customers", payload);
        toast.success("Created successfully");
      }
      setCustomerSheetOpen(false);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setCustomerError(msg); toast.error(msg);
    } finally { setCustomerSaving(false); }
  }

  async function handleDeleteCustomer(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try {
      await apiDelete(`/api/crm/customers/${id}`);
      if (selected?.id === id) setDetailOpen(false);
      toast.success("Deleted");
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleAddDeal() {
    if (!selected || !dealForm.title.trim()) { setDealError("Title is required"); return; }
    setDealSaving(true); setDealError(null);
    try {
      const { deal } = await apiPost<{ deal: Deal }>("/api/crm/deals", {
        title:     dealForm.title,
        value:     dealForm.value ? parseFloat(dealForm.value) : undefined,
        currency:  dealForm.currency,
        status:    dealForm.status,
        companyId: selected.id,
        closeDate: dealForm.closeDate ? new Date(dealForm.closeDate).toISOString() : undefined,
      });
      const newDeal = deal as Deal;
      setSelected((prev) => prev ? { ...prev, deals: [newDeal, ...prev.deals] } : prev);
      setCustomers((prev) =>
        prev.map((c) => c.id === selected.id ? { ...c, deals: [newDeal, ...c.deals] } : c)
      );
      setAddingDeal(false);
      setDealForm({ ...DEAL_EMPTY_BASE, currency });
      toast.success("Deal created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create deal";
      setDealError(msg); toast.error(msg);
    } finally { setDealSaving(false); }
  }

  async function handleAddLog() {
    if (!selected) return;
    if (!logForm.subject.trim() && !logForm.body.trim()) {
      setLogError("Subject or details are required");
      return;
    }
    setLogSaving(true); setLogError(null);
    try {
      const { log } = await apiPost<{ log: CompanyLog }>(
        `/api/contacts/companies/${selected.id}/logs`,
        { type: logForm.type, subject: logForm.subject || undefined, body: logForm.body || undefined },
      );
      setLogs((prev) => [log, ...prev]);
      setAddingLog(false);
      setLogForm(LOG_EMPTY);
      toast.success("Activity logged");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to log";
      setLogError(msg); toast.error(msg);
    } finally { setLogSaving(false); }
  }

  async function handleDeleteLog(logId: string) {
    if (!selected) return;
    const ok = await askConfirm();
    if (!ok) return;
    try {
      await apiDelete(`/api/contacts/companies/${selected.id}/logs/${logId}`);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      toast.success("Log deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.email    ?? "").toLowerCase().includes(q)
    );
  });
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
          <Button size="sm" variant="outline" onClick={() =>
            exportCSV("customers.csv",
              ["Name", "Email", "Phone", "Industry", "Website"],
              filtered.map((c) => [c.name, c.email, c.phone, c.industry, c.website]),
            )
          }>
            <Download className="w-3.5 h-3.5 mr-1" />Export
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Customer
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Deals</TableHead>
              <TableHead>Since</TableHead>
              <TableHead className="w-20" />
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
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(c)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.industry ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell>
                    {c.contacts.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        <Users className="w-3 h-3" />{c.contacts.length}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
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
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteCustomer(c.id)}>
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

      {/* Create / Edit Customer Sheet */}
      <Sheet open={customerSheetOpen} onOpenChange={setCustomerSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingCustomer ? "Edit Customer" : "New Customer"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {customerError && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                {customerError}
              </p>
            )}
            <Field label="Company Name *">
              <Input
                value={customerForm.name}
                onChange={(e) => setCustomerForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Acme Inc."
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry">
                <Input
                  value={customerForm.industry}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Manufacturing"
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555 0100"
                />
              </Field>
            </div>
            <Field label="Email">
              <Input
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
              />
            </Field>
            <Field label="Website">
              <Input
                value={customerForm.website}
                onChange={(e) => setCustomerForm((f) => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </Field>
            <Field label="Address">
              <Input
                value={customerForm.address}
                onChange={(e) => setCustomerForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St, City"
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={customerForm.notes}
                onChange={(e) => setCustomerForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any notes…"
                rows={3}
              />
            </Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSaveCustomer} disabled={customerSaving}>
              {customerSaving ? "Saving…" : editingCustomer ? "Save Changes" : "Create Customer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Customer Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={(open) => { if (!open) closeDetail(); else setDetailOpen(true); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3 pr-6">
                  <CustomerAvatar name={selected.name} />
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg leading-tight">{selected.name}</SheetTitle>
                    {selected.industry && (
                      <p className="text-sm text-muted-foreground">{selected.industry}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon-sm" onClick={() => { setDetailOpen(false); openEdit(selected); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteCustomer(selected.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="px-4 py-4 space-y-6">

                <div className="space-y-1.5">
                  {selected.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground shrink-0" />{selected.email}
                    </div>
                  )}
                  {selected.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />{selected.phone}
                    </div>
                  )}
                  {selected.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                      <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                        {selected.website}
                      </a>
                    </div>
                  )}
                  {selected.address && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />{selected.address}
                    </div>
                  )}
                  {selected.notes && (
                    <p className="text-sm text-muted-foreground italic border-t pt-2 mt-2">{selected.notes}</p>
                  )}
                </div>

                {/* Contacts */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-semibold flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Contacts
                    <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                      {selected.contacts.length}
                    </span>
                  </p>
                  {selected.contacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                      No contacts yet — add people to this company in the Contacts module
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selected.contacts.map((contact) => (
                        <div key={contact.id} className="flex items-start gap-3 rounded-lg border p-3">
                          <CustomerAvatar name={contact.name} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{contact.name}</span>
                              {contact.position && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                  {contact.position}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 space-y-0.5">
                              {contact.email && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="w-3 h-3 shrink-0" />{contact.email}
                                </p>
                              )}
                              {contact.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="w-3 h-3 shrink-0" />{contact.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deals */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4" />
                      Deals
                      <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {selected.deals.length}
                      </span>
                    </p>
                    {!addingDeal && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setDealForm({ ...DEAL_EMPTY_BASE, currency });
                        setDealError(null);
                        setAddingDeal(true);
                      }}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Add Deal
                      </Button>
                    )}
                  </div>

                  {addingDeal && (
                    <div className="rounded-lg border p-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Deal</p>
                      {dealError && (
                        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                          {dealError}
                        </p>
                      )}
                      <Field label="Title *">
                        <Input
                          value={dealForm.title}
                          onChange={(e) => setDealForm((f) => ({ ...f, title: e.target.value }))}
                          placeholder="Deal title"
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label={`Value (${currency})`}>
                          <Input
                            type="number"
                            value={dealForm.value}
                            onChange={(e) => setDealForm((f) => ({ ...f, value: e.target.value }))}
                            placeholder="0"
                            min="0"
                          />
                        </Field>
                        <Field label="Stage">
                          <Select value={dealForm.status} onValueChange={(v) => v && setDealForm((f) => ({ ...f, status: v }))}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="qualified">Qualified</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="negotiation">Negotiation</SelectItem>
                              <SelectItem value="won">Won</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <Field label="Close Date">
                        <Input
                          type="date"
                          value={dealForm.closeDate}
                          onChange={(e) => setDealForm((f) => ({ ...f, closeDate: e.target.value }))}
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddDeal} disabled={dealSaving}>
                          {dealSaving ? "Creating…" : "Create Deal"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingDeal(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {selected.deals.length === 0 && !addingDeal ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                      No deals yet — click Add Deal to create one
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selected.deals.map((deal) => (
                        <div key={deal.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm truncate">{deal.title}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {deal.value != null && (
                              <span className="text-sm font-medium">
                                {formatCurrency(deal.value, currency)}
                              </span>
                            )}
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded-full font-medium capitalize",
                              DEAL_STATUS_COLOR[deal.status] ?? "bg-muted",
                            )}>
                              {deal.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activity Log */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4" />
                      Activity
                      <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {logs.length}
                      </span>
                    </p>
                    {!addingLog && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setLogForm(LOG_EMPTY);
                        setLogError(null);
                        setAddingLog(true);
                      }}>
                        <Plus className="w-3.5 h-3.5 mr-1" />Log Activity
                      </Button>
                    )}
                  </div>

                  {addingLog && (
                    <div className="rounded-lg border p-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Log Activity</p>
                      {logError && (
                        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">
                          {logError}
                        </p>
                      )}
                      <Field label="Type">
                        <Select value={logForm.type} onValueChange={(v) => v && setLogForm((f) => ({ ...f, type: v }))}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">📞 Call</SelectItem>
                            <SelectItem value="visit">🏢 Visit</SelectItem>
                            <SelectItem value="email">📧 Email</SelectItem>
                            <SelectItem value="note">📝 Note</SelectItem>
                            <SelectItem value="other">💬 Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Subject">
                        <Input
                          value={logForm.subject}
                          onChange={(e) => setLogForm((f) => ({ ...f, subject: e.target.value }))}
                          placeholder="Brief summary…"
                        />
                      </Field>
                      <Field label="Details">
                        <Textarea
                          value={logForm.body}
                          onChange={(e) => setLogForm((f) => ({ ...f, body: e.target.value }))}
                          placeholder="Additional notes…"
                          rows={3}
                        />
                      </Field>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddLog} disabled={logSaving}>
                          {logSaving ? "Logging…" : "Save Log"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingLog(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  {logsLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Loading activity…</p>
                  ) : logs.length === 0 && !addingLog ? (
                    <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                      No activity yet — click Log Activity to add one
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className={cn(
                            "flex items-start gap-3 rounded-lg border p-3",
                            LOG_COLORS[log.type] ?? LOG_COLORS.other,
                          )}
                        >
                          <span className="text-base shrink-0 mt-0.5" aria-hidden>
                            {LOG_EMOJIS[log.type] ?? "💬"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold uppercase tracking-wide">
                                {LOG_LABELS[log.type] ?? log.type}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                                {new Date(log.loggedAt).toLocaleDateString()}
                              </span>
                            </div>
                            {log.subject && (
                              <p className="text-sm font-medium mt-0.5">{log.subject}</p>
                            )}
                            {log.body && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{log.body}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 hover:text-destructive opacity-60 hover:opacity-100"
                            onClick={() => handleDeleteLog(log.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        description="This action cannot be undone."
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
