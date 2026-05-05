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
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmDialog, useConfirm } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/pagination";
import { exportCSV } from "@/lib/csv";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

type Employee = {
  id: string; name: string; email: string | null; phone: string | null;
  position: string | null; department: string | null; salary: number | null;
  status: string; hireDate: string | null; createdAt: string;
  _count: { leaveRequests: number };
};

const STATUS_COLOR: Record<string, string> = {
  active:     "bg-emerald-100 text-emerald-700",
  inactive:   "bg-slate-100 text-slate-700",
  terminated: "bg-red-100 text-red-700",
};

const EMPTY = {
  name: "", email: "", phone: "", position: "", department: "",
  salary: "", status: "active", hireDate: "", notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<Employee | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [search, setSearch]       = useState("");
  const [page, setPage]           = useState(1);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    apiGet<{ employees: Employee[] }>("/api/hr/employees?limit=100")
      .then((d) => setEmployees(d.employees))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name, email: emp.email ?? "", phone: emp.phone ?? "",
      position: emp.position ?? "", department: emp.department ?? "",
      salary: emp.salary?.toString() ?? "", status: emp.status,
      hireDate: emp.hireDate ? emp.hireDate.slice(0, 10) : "",
      notes: "",
    });
    setError(null); setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name, status: form.status,
        email:      form.email      || undefined,
        phone:      form.phone      || undefined,
        position:   form.position   || undefined,
        department: form.department || undefined,
        salary:     form.salary     ? parseFloat(form.salary) : undefined,
        hireDate:   form.hireDate   ? new Date(form.hireDate).toISOString() : undefined,
      };
      if (editing) await apiPatch(`/api/hr/employees/${editing.id}`, payload);
      else         await apiPost("/api/hr/employees", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { const msg = err instanceof Error ? err.message : "Save failed"; setError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/hr/employees/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  useEffect(() => { setPage(1); }, [search]);

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.department ?? "").toLowerCase().includes(q) || (e.position ?? "").toLowerCase().includes(q);
  });
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs h-8 text-sm" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("employees.csv",
            ["Name","Position","Department","Status","Hire Date","Salary"],
            filtered.map((e) => [e.name, e.position, e.department, e.status, e.hireDate ? new Date(e.hireDate).toLocaleDateString() : "", e.salary])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />Add Employee</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Hire Date</TableHead>
              <TableHead>Salary</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{search ? "No matching employees" : "No employees yet"}</TableCell></TableRow>
            ) : paginated.map((emp) => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell className="text-muted-foreground">{emp.position ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{emp.department ?? "—"}</TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[emp.status] ?? "bg-muted")}>{emp.status}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{emp.salary != null ? `$${emp.salary.toLocaleString()}` : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(emp)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(emp.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Employee" : "New Employee"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <Field label="Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Position"><Input value={form.position} onChange={(e) => set("position", e.target.value)} placeholder="Software Engineer" /></Field>
              <Field label="Department"><Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder="Engineering" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["active", "inactive", "terminated"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Hire Date"><Input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} /></Field>
            </div>
            <Field label="Salary ($)"><Input type="number" min="0" value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="Annual salary" /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Add Employee"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
