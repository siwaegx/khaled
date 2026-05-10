"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, LayoutList, LayoutGrid,
  Building2, Globe, Phone, Mail, MapPin, Users, ChevronRight,
  ClipboardList,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

type CrmContact = {
  id: string;
  companyId: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
};

type CrmCompany = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  contacts: CrmContact[];
};

type CompanyLog = {
  id: string;
  companyId: string;
  type: "call" | "visit" | "email" | "note" | "other";
  subject: string | null;
  body: string | null;
  loggedAt: string;
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

const EMPTY_COMPANY = { name: "", industry: "", website: "", phone: "", email: "", address: "", notes: "" };
const EMPTY_CONTACT = { name: "", position: "", email: "", phone: "", notes: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ContactAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
      {initials}
    </div>
  );
}

export default function CompaniesPage() {
  const [companies, setCompanies]         = useState<CrmCompany[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [page, setPage]                   = useState(1);
  const [viewMode, setViewMode]           = useState<"list" | "card">("list");

  const [createOpen, setCreateOpen]       = useState(false);
  const [companyForm, setCompanyForm]     = useState(EMPTY_COMPANY);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyError, setCompanyError]   = useState<string | null>(null);

  const [detailOpen, setDetailOpen]             = useState(false);
  const [selected, setSelected]                 = useState<CrmCompany | null>(null);
  const [editingCompany, setEditingCompany]     = useState(false);
  const [editForm, setEditForm]                 = useState(EMPTY_COMPANY);
  const [editSaving, setEditSaving]             = useState(false);
  const [editError, setEditError]               = useState<string | null>(null);

  const [addingContact, setAddingContact]       = useState(false);
  const [contactForm, setContactForm]           = useState(EMPTY_CONTACT);
  const [contactSaving, setContactSaving]       = useState(false);
  const [contactError, setContactError]         = useState<string | null>(null);
  const [editingContact, setEditingContact]     = useState<CrmContact | null>(null);

  const [logs, setLogs]               = useState<CompanyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [addingLog, setAddingLog]     = useState(false);
  const [logForm, setLogForm]         = useState({ type: "note", subject: "", body: "" });
  const [logSaving, setLogSaving]     = useState(false);
  const [logError, setLogError]       = useState<string | null>(null);

  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ companies: CrmCompany[] }>("/api/contacts/companies")
      .then((d) => setCompanies(d.companies))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const filtered  = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.industry ?? "").toLowerCase().includes(q) ||
      (c.email    ?? "").toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openDetail(company: CrmCompany) {
    setSelected(company);
    setEditingCompany(false);
    setAddingContact(false);
    setEditingContact(null);
    setAddingLog(false);
    setLogForm({ type: "note", subject: "", body: "" });
    setDetailOpen(true);
    setLogsLoading(true);
    apiGet<{ logs: CompanyLog[] }>(`/api/contacts/companies/${company.id}/logs`)
      .then((d) => setLogs(d.logs))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }

  function syncSelected(updated: CrmCompany) {
    setSelected(updated);
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function handleCreate() {
    if (!companyForm.name.trim()) { setCompanyError("Name is required"); return; }
    setCompanySaving(true); setCompanyError(null);
    try {
      const { company } = await apiPost<{ company: CrmCompany }>("/api/contacts/companies", {
        ...companyForm, email: companyForm.email || undefined,
      });
      setCreateOpen(false);
      setCompanyForm(EMPTY_COMPANY);
      setCompanies((prev) => [company, ...prev]);
      toast.success("Company created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setCompanyError(msg); toast.error(msg);
    } finally { setCompanySaving(false); }
  }

  function startEditCompany() {
    if (!selected) return;
    setEditForm({
      name:     selected.name,
      industry: selected.industry ?? "",
      website:  selected.website  ?? "",
      phone:    selected.phone    ?? "",
      email:    selected.email    ?? "",
      address:  selected.address  ?? "",
      notes:    selected.notes    ?? "",
    });
    setEditError(null);
    setEditingCompany(true);
  }

  async function handleSaveCompany() {
    if (!selected || !editForm.name.trim()) { setEditError("Name is required"); return; }
    setEditSaving(true); setEditError(null);
    try {
      const { company } = await apiPatch<{ company: CrmCompany }>(
        `/api/contacts/companies/${selected.id}`,
        { ...editForm, email: editForm.email || undefined },
      );
      syncSelected(company);
      setEditingCompany(false);
      toast.success("Company updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setEditError(msg); toast.error(msg);
    } finally { setEditSaving(false); }
  }

  async function handleDeleteCompany(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try {
      await apiDelete(`/api/contacts/companies/${id}`);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setDetailOpen(false);
      toast.success("Company deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleAddContact() {
    if (!selected || !contactForm.name.trim()) { setContactError("Name is required"); return; }
    setContactSaving(true); setContactError(null);
    try {
      const { contact } = await apiPost<{ contact: CrmContact }>(
        `/api/contacts/companies/${selected.id}/contacts`,
        { ...contactForm, email: contactForm.email || undefined },
      );
      syncSelected({ ...selected, contacts: [...selected.contacts, contact] });
      setAddingContact(false);
      setContactForm(EMPTY_CONTACT);
      toast.success("Contact added");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setContactError(msg); toast.error(msg);
    } finally { setContactSaving(false); }
  }

  function startEditContact(contact: CrmContact) {
    setEditingContact(contact);
    setContactForm({
      name:     contact.name,
      position: contact.position ?? "",
      email:    contact.email    ?? "",
      phone:    contact.phone    ?? "",
      notes:    contact.notes    ?? "",
    });
    setContactError(null);
    setAddingContact(false);
  }

  async function handleSaveContact() {
    if (!selected || !editingContact || !contactForm.name.trim()) {
      setContactError("Name is required"); return;
    }
    setContactSaving(true); setContactError(null);
    try {
      const { contact } = await apiPatch<{ contact: CrmContact }>(
        `/api/contacts/companies/${selected.id}/contacts/${editingContact.id}`,
        { ...contactForm, email: contactForm.email || undefined },
      );
      syncSelected({
        ...selected,
        contacts: selected.contacts.map((c) => (c.id === contact.id ? contact : c)),
      });
      setEditingContact(null);
      toast.success("Contact updated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setContactError(msg); toast.error(msg);
    } finally { setContactSaving(false); }
  }

  async function handleDeleteContact(contactId: string) {
    if (!selected) return;
    const ok = await askConfirm();
    if (!ok) return;
    try {
      await apiDelete(`/api/contacts/companies/${selected.id}/contacts/${contactId}`);
      syncSelected({ ...selected, contacts: selected.contacts.filter((c) => c.id !== contactId) });
      toast.success("Contact removed");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
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
      setLogForm({ type: "note", subject: "", body: "" });
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

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search companies…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("card")}
              title="Card view"
              className={cn(
                "p-1.5 transition-colors",
                viewMode === "card" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <Button size="sm" onClick={() => { setCompanyForm(EMPTY_COMPANY); setCompanyError(null); setCreateOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Company
          </Button>
        </div>
      </div>

      {/* List view */}
      {viewMode === "list" && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Since</TableHead>
                <TableHead className="w-8" />
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
                    {search ? "No matching companies" : "No companies yet — add your first one"}
                  </TableCell>
                </TableRow>
              ) : paginated.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(company)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="font-medium">{company.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.industry ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{company.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{company.phone ?? "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                      {company.contacts.length} contact{company.contacts.length !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(company.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Card view */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3 animate-pulse">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-16">
              {search ? "No matching companies" : "No companies yet — add your first one"}
            </div>
          ) : paginated.map((company) => (
            <div
              key={company.id}
              onClick={() => openDetail(company)}
              className="rounded-lg border p-4 cursor-pointer hover:shadow-md hover:border-primary/40 transition-all space-y-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{company.name}</p>
                  {company.industry && (
                    <p className="text-xs text-muted-foreground">{company.industry}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                {company.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 shrink-0" />{company.email}
                  </div>
                )}
                {company.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />{company.phone}
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Globe className="w-3 h-3 shrink-0" />{company.website}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-1 border-t">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  {company.contacts.length} contact{company.contacts.length !== 1 ? "s" : ""}
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      {/* Create sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>New Company</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {companyError && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{companyError}</p>
            )}
            <Field label="Company Name *">
              <Input value={companyForm.name} onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Corp." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Industry">
                <Input value={companyForm.industry} onChange={(e) => setCompanyForm((f) => ({ ...f, industry: e.target.value }))} placeholder="Technology" />
              </Field>
              <Field label="Phone">
                <Input value={companyForm.phone} onChange={(e) => setCompanyForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555 0100" />
              </Field>
            </div>
            <Field label="Email">
              <Input type="email" value={companyForm.email} onChange={(e) => setCompanyForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@company.com" />
            </Field>
            <Field label="Website">
              <Input value={companyForm.website} onChange={(e) => setCompanyForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://company.com" />
            </Field>
            <Field label="Address">
              <Input value={companyForm.address} onChange={(e) => setCompanyForm((f) => ({ ...f, address: e.target.value }))} placeholder="123 Main St, City" />
            </Field>
            <Field label="Notes">
              <Textarea value={companyForm.notes} onChange={(e) => setCompanyForm((f) => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any notes…" />
            </Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleCreate} disabled={companySaving}>
              {companySaving ? "Creating…" : "Create Company"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail sheet */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) { setEditingCompany(false); setAddingContact(false); setEditingContact(null); }
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-2 pr-6">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-lg leading-tight">{selected.name}</SheetTitle>
                      {selected.industry && <p className="text-sm text-muted-foreground mt-0.5">{selected.industry}</p>}
                    </div>
                  </div>
                  {!editingCompany && (
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon-sm" onClick={startEditCompany}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteCompany(selected.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </SheetHeader>

              <div className="px-4 py-4 space-y-6">

                {/* Company info */}
                {editingCompany ? (
                  <div className="space-y-3 rounded-lg border p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Company</p>
                    {editError && (
                      <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{editError}</p>
                    )}
                    <Field label="Name *">
                      <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Industry">
                        <Input value={editForm.industry} onChange={(e) => setEditForm((f) => ({ ...f, industry: e.target.value }))} />
                      </Field>
                      <Field label="Phone">
                        <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                      </Field>
                    </div>
                    <Field label="Email">
                      <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    </Field>
                    <Field label="Website">
                      <Input value={editForm.website} onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))} />
                    </Field>
                    <Field label="Address">
                      <Input value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} />
                    </Field>
                    <Field label="Notes">
                      <Textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                    </Field>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveCompany} disabled={editSaving}>
                        {editSaving ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingCompany(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
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
                        <a href={selected.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          {selected.website}
                        </a>
                      </div>
                    )}
                    {selected.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />{selected.address}
                      </div>
                    )}
                    {selected.notes && (
                      <p className="text-sm text-muted-foreground italic border-t pt-2 mt-2">{selected.notes}</p>
                    )}
                    {!selected.email && !selected.phone && !selected.website && !selected.address && !selected.notes && (
                      <p className="text-sm text-muted-foreground">No details — click the edit button to add them.</p>
                    )}
                  </div>
                )}

                {/* Contacts */}
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      Contacts
                      <span className="ml-1 text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {selected.contacts.length}
                      </span>
                    </p>
                    {!addingContact && !editingContact && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setContactForm(EMPTY_CONTACT); setContactError(null); setAddingContact(true); }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />Add
                      </Button>
                    )}
                  </div>

                  {addingContact && (
                    <div className="rounded-lg border p-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Contact</p>
                      {contactError && (
                        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{contactError}</p>
                      )}
                      <Field label="Name *">
                        <Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
                      </Field>
                      <Field label="Position">
                        <Input value={contactForm.position} onChange={(e) => setContactForm((f) => ({ ...f, position: e.target.value }))} placeholder="CEO, Sales Manager…" />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Email">
                          <Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
                        </Field>
                        <Field label="Phone">
                          <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
                        </Field>
                      </div>
                      <Field label="Notes">
                        <Input value={contactForm.notes} onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                      </Field>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddContact} disabled={contactSaving}>
                          {contactSaving ? "Adding…" : "Add Contact"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAddingContact(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {selected.contacts.length === 0 && !addingContact ? (
                      <p className="text-sm text-muted-foreground text-center py-6 border rounded-lg">
                        No contacts yet — click Add to add one
                      </p>
                    ) : selected.contacts.map((contact) => (
                      <div key={contact.id} className="rounded-lg border p-3">
                        {editingContact?.id === contact.id ? (
                          <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Contact</p>
                            {contactError && (
                              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{contactError}</p>
                            )}
                            <Field label="Name *">
                              <Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} />
                            </Field>
                            <Field label="Position">
                              <Input value={contactForm.position} onChange={(e) => setContactForm((f) => ({ ...f, position: e.target.value }))} />
                            </Field>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Email">
                                <Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
                              </Field>
                              <Field label="Phone">
                                <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} />
                              </Field>
                            </div>
                            <Field label="Notes">
                              <Input value={contactForm.notes} onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))} />
                            </Field>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={handleSaveContact} disabled={contactSaving}>
                                {contactSaving ? "Saving…" : "Save"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setEditingContact(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <ContactAvatar name={contact.name} />
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
                                {contact.notes && (
                                  <p className="text-xs text-muted-foreground italic">{contact.notes}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button variant="ghost" size="icon-sm" onClick={() => startEditContact(contact)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteContact(contact.id)}>
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setLogForm({ type: "note", subject: "", body: "" }); setLogError(null); setAddingLog(true); }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />Log Activity
                      </Button>
                    )}
                  </div>

                  {addingLog && (
                    <div className="rounded-lg border p-3 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Log Activity</p>
                      {logError && (
                        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{logError}</p>
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
                            className="shrink-0 opacity-60 hover:opacity-100 hover:text-destructive"
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
