"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Download, Check, X } from "lucide-react";
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

type LeaveRequest = {
  id: string; employeeId: string; type: string; status: string;
  startDate: string; endDate: string; days: number;
  reason: string | null; notes: string | null; createdAt: string;
  employee: { id: string; name: string; department: string | null };
};

type Employee = { id: string; name: string };

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-emerald-100 text-emerald-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-slate-100 text-slate-500",
};

const LEAVE_TYPES   = ["annual", "sick", "unpaid", "maternity", "paternity", "other"];
const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];

const EMPTY = {
  employeeId: "", type: "annual", status: "pending",
  startDate: "", endDate: "", days: "", reason: "", notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export default function LeavePage() {
  const [requests, setRequests]   = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [editing, setEditing]     = useState<LeaveRequest | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const { confirm: askConfirm, isOpen: confirmOpen, handleConfirm, handleCancel } = useConfirm();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiGet<{ requests: LeaveRequest[] }>("/api/hr/leave?limit=100"),
      apiGet<{ employees: Employee[] }>("/api/hr/employees?limit=200"),
    ])
      .then(([lr, emp]) => { setRequests(lr.requests); setEmployees(emp.employees); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm(EMPTY); setError(null); setOpen(true); }

  function openEdit(r: LeaveRequest) {
    setEditing(r);
    setForm({
      employeeId: r.employeeId, type: r.type, status: r.status,
      startDate: r.startDate.slice(0, 10), endDate: r.endDate.slice(0, 10),
      days: r.days.toString(), reason: r.reason ?? "", notes: r.notes ?? "",
    });
    setError(null); setOpen(true);
  }

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSave() {
    if (!form.employeeId) { setError("Employee is required"); return; }
    if (!form.startDate)  { setError("Start date is required"); return; }
    if (!form.endDate)    { setError("End date is required"); return; }
    if (!form.days)       { setError("Days is required"); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        employeeId: form.employeeId, type: form.type, status: form.status,
        startDate: new Date(form.startDate).toISOString(),
        endDate:   new Date(form.endDate).toISOString(),
        days:   parseFloat(form.days),
        reason: form.reason || undefined,
        notes:  form.notes  || undefined,
      };
      if (editing) await apiPatch(`/api/hr/leave/${editing.id}`, payload);
      else         await apiPost("/api/hr/leave", payload);
      setOpen(false);
      toast.success(editing ? "Saved successfully" : "Created successfully");
      load();
    } catch (err) { const msg = err instanceof Error ? err.message : "Save failed"; setError(msg); toast.error(msg); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    const ok = await askConfirm();
    if (!ok) return;
    try { await apiDelete(`/api/hr/leave/${id}`); toast.success("Deleted successfully"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Delete failed"); }
  }

  async function handleApprove(id: string) {
    try { await apiPatch(`/api/hr/leave/${id}`, { status: "approved" }); toast.success("Approved"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  async function handleReject(id: string) {
    try { await apiPatch(`/api/hr/leave/${id}`, { status: "rejected" }); toast.success("Rejected"); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV("leave-requests.csv",
            ["Employee","Type","Status","Start","End","Days","Reason"],
            requests.map((r) => [r.employee.name, r.type, r.status, new Date(r.startDate).toLocaleDateString(), new Date(r.endDate).toLocaleDateString(), r.days, r.reason])
          )}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-3.5 h-3.5 mr-1" />New Request</Button>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Days</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Loading…</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No leave requests yet</TableCell></TableRow>
            ) : requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.employee.name}</TableCell>
                <TableCell className="capitalize text-muted-foreground">{r.type}</TableCell>
                <TableCell>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", STATUS_COLOR[r.status] ?? "bg-muted")}>{r.status}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(r.startDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(r.endDate).toLocaleDateString()}</TableCell>
                <TableCell className="text-muted-foreground">{r.days}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {r.status === "pending" && (
                      <>
                        <Button variant="ghost" size="icon-sm" title="Approve" onClick={() => handleApprove(r.id)}>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" title="Reject" onClick={() => handleReject(r.id)}>
                          <X className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editing ? "Edit Leave Request" : "New Leave Request"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
            <Field label="Employee *">
              <Select value={form.employeeId} onValueChange={(v) => v && set("employeeId", v)}>
                <SelectTrigger className="w-full h-9"><SelectValue placeholder="Select employee…" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.type} onValueChange={(v) => v && set("type", v)}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => v && set("status", v)}>
                  <SelectTrigger className="w-full h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAVE_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Date *"><Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="End Date *"><Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
            </div>
            <Field label="Days *"><Input type="number" min="0.5" step="0.5" value={form.days} onChange={(e) => set("days", e.target.value)} placeholder="1" /></Field>
            <Field label="Reason"><Input value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Annual holiday…" /></Field>
            <Field label="Notes"><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} /></Field>
          </div>
          <SheetFooter>
            <SheetClose render={<Button variant="outline" size="sm" />}>Cancel</SheetClose>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save Changes" : "Submit Request"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={confirmOpen} description="This action cannot be undone." onConfirm={handleConfirm} onCancel={handleCancel} />
    </div>
  );
}
