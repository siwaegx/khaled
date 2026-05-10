"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, LayoutList, LayoutGrid,
  Building2, Phone, Mail,
} from "lucide-react";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 20;

type Company = { id: string; name: string; industry: string | null };

type Contact = {
  id: string;
  companyId: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  company: Company;
};

const EMPTY_FORM = { name: "", position: "", email: "", phone: "", notes: "", companyId: "" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
      {initials}
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const [viewMode, setViewMode]   = useState<"list" | "card">("list");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing]     = useState<Contact | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const loadContacts = useCallback(() => {
    setLoading(true);
    apiGet<{ contacts: Contact[] }>("/api/contacts/contacts")
      .then((d) => setContacts(d.contacts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadContacts();
    apiGet<{ companies: Company[] }>("/api/contacts/companies")
      .then((d) => setCompanies(d.companies))
      .catch(() => {});
  }, [loadContacts]);

  useEffect(() => { setPage(1); }, [search]);

  const filtered  = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.position    ?? "").toLowerCase().includes(q) ||
      (c.email       ?? "").toLowerCase().includes(q) ||
      (c.company?.name ?? "").toLowerCase().includes(q)
    );
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setSheetOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    setForm({
      name:      contact.name,
      position:  contact.position ?? "",
      email:     contact.email    ?? "",
      phone:     contact.phone    ?? "",
      notes:     contact.notes    ?? "",
      companyId: contact.companyId,
    });
    setError(null);
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim())      { setError("Name is required");    return; }
    if (!form.companyId.trim()) { setError("Company is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form, email: form.email || undefined };
      if (editing) {
        const { contact } = await apiPatch<{ contact: Contact }>(
          `/api/contacts/contacts/${editing.id}`, payload,
        );
        setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
      } else {
        const { contact } = await apiPost<{ contact: Contact }>("/api/contacts/contacts", payload);
        setContacts((prev) => [contact, ...prev]);
      }
      setSheetOpen(false);
      toast.success(editing ? "Contact updated" : "Contact created");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setError(msg); toast.error(msg);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try {
      await apiDelete(`/api/contacts/contacts/${id}`);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contact deleted");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search contacts…"
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
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5 mr-1" />Add Contact
          </Button>
        </div>
      </div>

      {/* List view */}
      {viewMode === "list" && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    {search ? "No matching contacts" : "No contacts yet — add your first one"}
                  </TableCell>
                </TableRow>
              ) : paginated.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar name={contact.name} />
                      <span className="font-medium">{contact.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.position ? (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {contact.position}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{contact.company?.name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{contact.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{contact.phone ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(contact)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(contact.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
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
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-16">
              {search ? "No matching contacts" : "No contacts yet — add your first one"}
            </div>
          ) : paginated.map((contact) => (
            <div key={contact.id} className="rounded-lg border p-4 space-y-3 hover:shadow-md hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <Avatar name={contact.name} />
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{contact.name}</p>
                    {contact.position && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {contact.position}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(contact)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(contact.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3 h-3 shrink-0" />
                  <span className="truncate font-medium text-foreground">{contact.company?.name}</span>
                  {contact.company?.industry && (
                    <span className="text-muted-foreground">· {contact.company.industry}</span>
                  )}
                </div>
                {contact.email && (
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3 h-3 shrink-0" />{contact.email}
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />{contact.phone}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

      {/* Create / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Contact" : "New Contact"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>
            )}

            <Field label="Company *">
              <Select
                value={form.companyId}
                onValueChange={(v) => v && setForm((f) => ({ ...f, companyId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company…" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.industry ? ` · ${c.industry}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jane Smith"
              />
            </Field>
            <Field label="Position">
              <Input
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                placeholder="CEO, Sales Manager…"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555 0100"
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Any notes…"
              />
            </Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Contact"}
            </Button>
          </SheetFooter>
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
