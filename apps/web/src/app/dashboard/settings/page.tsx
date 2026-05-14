"use client";

import { useEffect, useState, useCallback } from "react";
import {
  User, Building2, Crown, Shield, UserCircle, KeyRound, Key, Trash2, Plus,
  Eye, EyeOff, Mail, X, UserPlus, Users, LayoutGrid, ChevronDown, Check,
  ShieldCheck, LogOut, Settings2, Webhook, AlertCircle, CheckCircle2,
  Lock, Info, TrendingUp, Package, Calculator, Wrench, HeadphonesIcon, Pencil,
  Smartphone, Monitor, QrCode,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { apiGet, apiPost, apiPatch, apiDelete, apiPut } from "@/lib/api";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgRole = "owner" | "manager" | "sales_leader" | "inventory_manager" | "accountant" | "engineer" | "service_agent" | "member";

type Member = {
  id:     string;
  role:   OrgRole;
  userId: string;
  user:   { id: string; name: string; email: string };
};

type InviteRecord = {
  id: string; email: string; role: string; expiresAt: string; createdAt: string;
};

type ApiKeyRecord = {
  id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null;
};

type TeamMemberEntry = {
  id:     string;
  member: Member;
};

type Team = {
  id:        string;
  name:      string;
  moduleKey: string;
  leaderId:  string | null;
  leader:    Member | null;
  members:   TeamMemberEntry[];
};

type InstalledModule = { moduleKey: string; isActive: boolean };

type ModuleAccessMap = Record<string, Record<string, boolean>>;

type ConfigItem = { id: string; value: string; color?: string | null; order: number; isActive: boolean };
type ConfigList = { id: string; key: string; label: string; description?: string | null; isSystem: boolean; items: ConfigItem[] };

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  crm:        "CRM",
  contacts:   "Contacts",
  inventory:  "Inventory",
  accounting: "Accounting",
  hr:         "HR",
  projects:   "Projects",
  reports:    "Reports",
};

const ROLE_COLOR: Record<string, string> = {
  owner:             "border-violet-200 bg-violet-50 text-violet-700",
  manager:           "border-blue-200 bg-blue-50 text-blue-700",
  sales_leader:      "border-emerald-200 bg-emerald-50 text-emerald-700",
  inventory_manager: "border-orange-200 bg-orange-50 text-orange-700",
  accountant:        "border-amber-200 bg-amber-50 text-amber-700",
  engineer:          "border-cyan-200 bg-cyan-50 text-cyan-700",
  service_agent:     "border-rose-200 bg-rose-50 text-rose-700",
  member:            "border-border bg-muted text-muted-foreground",
};

const ROLE_LABEL: Record<string, string> = {
  owner:             "Owner",
  manager:           "Manager",
  sales_leader:      "Sales Leader",
  inventory_manager: "Inventory Manager",
  accountant:        "Accountant",
  engineer:          "Engineer",
  service_agent:     "Service Agent",
  member:            "Member",
};

const ROLE_ICON: Record<string, typeof Crown> = {
  owner:             Crown,
  manager:           Shield,
  sales_leader:      TrendingUp,
  inventory_manager: Package,
  accountant:        Calculator,
  engineer:          Wrench,
  service_agent:     HeadphonesIcon,
  member:            UserCircle,
};

type Tab = "account" | "organization" | "members" | "module-access" | "teams" | "api-keys" | "webhooks" | "configuration";

const TABS: { key: Tab; label: string; icon: typeof User; ownerOnly?: boolean; managerPlus?: boolean }[] = [
  { key: "account",       label: "Account",        icon: User                           },
  { key: "organization",  label: "Organization",   icon: Building2                      },
  { key: "members",       label: "Members",        icon: Users,       managerPlus: true  },
  { key: "module-access", label: "Module Access",  icon: LayoutGrid,  ownerOnly: true   },
  { key: "teams",         label: "Teams",          icon: ShieldCheck, managerPlus: true  },
  { key: "configuration", label: "Configuration",  icon: Settings2,   managerPlus: true  },
  { key: "api-keys",      label: "API Keys",       icon: Key,         ownerOnly: true   },
  { key: "webhooks",      label: "Webhooks",       icon: Webhook,     ownerOnly: true   },
];

// ─── Account Tab ──────────────────────────────────────────────────────────────

function PasswordChangeForm() {
  const [form, setForm]     = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); setSuccess(false); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setError("New passwords do not match"); return; }
    if (form.newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setSaving(true); setError(null);
    try {
      await apiPost("/api/auth/change-password", { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error   && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}
      {success && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">Password changed successfully.</p>}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Current Password</Label>
        <Input type="password" value={form.currentPassword} onChange={(e) => set("currentPassword", e.target.value)} placeholder="Enter current password" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">New Password</Label>
          <Input type="password" value={form.newPassword} onChange={(e) => set("newPassword", e.target.value)} placeholder="Min 8 characters" required />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Confirm New Password</Label>
          <Input type="password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} placeholder="Repeat new password" required />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={saving}>{saving ? "Changing…" : "Change Password"}</Button>
    </form>
  );
}

// ─── TOTP 2FA Section ─────────────────────────────────────────────────────────

function TotpSection() {
  const [enabled, setEnabled]   = useState<boolean | null>(null);
  const [step, setStep]         = useState<"idle" | "setup" | "disable">("idle");
  const [qr, setQr]             = useState<string | null>(null);
  const [token, setToken]       = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    apiGet<{ totpEnabled: boolean }>("/api/auth/totp/status")
      .then((d) => setEnabled(d.totpEnabled))
      .catch(() => setEnabled(false));
  }, []);

  async function startSetup() {
    setSaving(true); setError(null);
    try {
      const d = await apiPost<{ qrDataUrl: string }>("/api/auth/totp/setup", {});
      setQr(d.qrDataUrl);
      setStep("setup");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function verifyToken() {
    setSaving(true); setError(null);
    try {
      await apiPost("/api/auth/totp/verify", { token });
      setEnabled(true); setStep("idle"); setQr(null); setToken("");
      toast.success("Two-factor authentication enabled");
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid code"); }
    finally { setSaving(false); }
  }

  async function disableTotp() {
    setSaving(true); setError(null);
    try {
      await apiPost("/api/auth/totp/disable", { token });
      setEnabled(false); setStep("idle"); setToken("");
      toast.success("Two-factor authentication disabled");
    } catch (e) { setError(e instanceof Error ? e.message : "Invalid code"); }
    finally { setSaving(false); }
  }

  if (enabled === null) return <div className="h-8 animate-pulse bg-muted rounded" />;

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>}

      {step === "idle" && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{enabled ? "Enabled" : "Disabled"}</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? "Your account is protected with an authenticator app." : "Add an extra layer of security to your account."}
            </p>
          </div>
          <Button size="sm" variant={enabled ? "destructive" : "default"}
            onClick={() => enabled ? setStep("disable") : startSetup()} disabled={saving}>
            {saving ? "Loading…" : enabled ? "Disable 2FA" : "Enable 2FA"}
          </Button>
        </div>
      )}

      {step === "setup" && qr && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code to confirm.</p>
          <div className="flex justify-center p-4 bg-white rounded-lg border w-fit mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="TOTP QR code" className="w-40 h-40" />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="000000"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              className="font-mono text-center tracking-widest"
            />
            <Button size="sm" onClick={verifyToken} disabled={token.length !== 6 || saving}>
              {saving ? "Verifying…" : "Verify"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setStep("idle"); setQr(null); setToken(""); setError(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {step === "disable" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Enter your current 6-digit code to confirm disabling 2FA.</p>
          <div className="flex gap-2">
            <Input
              placeholder="000000"
              maxLength={6}
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
              className="font-mono text-center tracking-widest"
            />
            <Button size="sm" variant="destructive" onClick={disableTotp} disabled={token.length !== 6 || saving}>
              {saving ? "Disabling…" : "Disable 2FA"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setStep("idle"); setToken(""); setError(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sessions Section ──────────────────────────────────────────────────────────

type SessionItem = { id: string; userAgent: string | null; ipAddress: string | null; createdAt: string; lastUsedAt: string };

function SessionsSection() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ sessions: SessionItem[] }>("/api/auth/sessions")
      .then((d) => setSessions(d.sessions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function revoke(id: string) {
    setRevoking(id);
    try {
      await apiDelete(`/api/auth/sessions/${id}`);
      setSessions((s) => s.filter((x) => x.id !== id));
      toast.success("Session revoked");
    } catch { toast.error("Failed to revoke session"); }
    finally { setRevoking(null); }
  }

  async function revokeAll() {
    setRevoking("all");
    try {
      await apiDelete("/api/auth/sessions");
      setSessions([]);
      toast.success("All other sessions revoked");
    } catch { toast.error("Failed to revoke sessions"); }
    finally { setRevoking(null); }
  }

  if (loading) return <div className="h-12 animate-pulse bg-muted rounded" />;

  return (
    <div className="space-y-3">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions found.</p>
      ) : (
        <>
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{s.userAgent ?? "Unknown device"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.ipAddress ?? "Unknown IP"} · Last active {new Date(s.lastUsedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button size="xs" variant="ghost" className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => revoke(s.id)} disabled={revoking === s.id}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
          {sessions.length > 1 && (
            <Button size="sm" variant="outline" onClick={revokeAll} disabled={revoking === "all"}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              {revoking === "all" ? "Revoking…" : "Revoke all other sessions"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function AccountTab() {
  const { user, role } = useAuth();
  const RoleIcon = ROLE_ICON[role ?? "member"] ?? UserCircle;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-semibold text-primary">{user?.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1">
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            {role && (
              <Badge variant="outline" className={cn("text-xs capitalize", ROLE_COLOR[role])}>
                <RoleIcon className="w-3 h-3 mr-1" /> {role}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" /> Change Password
          </CardTitle>
        </CardHeader>
        <CardContent><PasswordChangeForm /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-muted-foreground" /> Two-Factor Authentication
          </CardTitle>
        </CardHeader>
        <CardContent><TotpSection /></CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4 text-muted-foreground" /> Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent><SessionsSection /></CardContent>
      </Card>
    </div>
  );
}

// ─── Organization Tab ─────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: "USD", label: "US Dollar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "British Pound" },
  { code: "JPY", label: "Japanese Yen" },
  { code: "CNY", label: "Chinese Yuan" },
  { code: "INR", label: "Indian Rupee" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "MXN", label: "Mexican Peso" },
  { code: "BRL", label: "Brazilian Real" },
  { code: "KRW", label: "South Korean Won" },
  { code: "SGD", label: "Singapore Dollar" },
  { code: "HKD", label: "Hong Kong Dollar" },
  { code: "NOK", label: "Norwegian Krone" },
  { code: "SEK", label: "Swedish Krona" },
  { code: "DKK", label: "Danish Krone" },
  { code: "NZD", label: "New Zealand Dollar" },
  { code: "ZAR", label: "South African Rand" },
  { code: "AED", label: "UAE Dirham" },
  { code: "SAR", label: "Saudi Riyal" },
  { code: "THB", label: "Thai Baht" },
  { code: "IDR", label: "Indonesian Rupiah" },
  { code: "MYR", label: "Malaysian Ringgit" },
  { code: "PHP", label: "Philippine Peso" },
  { code: "TRY", label: "Turkish Lira" },
  { code: "PLN", label: "Polish Zloty" },
  { code: "CZK", label: "Czech Koruna" },
  { code: "HUF", label: "Hungarian Forint" },
  { code: "RON", label: "Romanian Leu" },
  { code: "QAR", label: "Qatari Riyal" },
  { code: "KWD", label: "Kuwaiti Dinar" },
  { code: "EGP", label: "Egyptian Pound" },
  { code: "NGN", label: "Nigerian Naira" },
  { code: "PKR", label: "Pakistani Rupee" },
  { code: "BDT", label: "Bangladeshi Taka" },
  { code: "VND", label: "Vietnamese Dong" },
  { code: "UAH", label: "Ukrainian Hryvnia" },
  { code: "ILS", label: "Israeli Shekel" },
  { code: "CLP", label: "Chilean Peso" },
];

function OrganizationTab() {
  const { org, role, refresh } = useAuth();
  const isOwner = role === "owner";

  const [currency, setCurrency]   = useState(org?.currency ?? "USD");
  const [saving, setSaving]       = useState(false);
  const isDirty = currency !== (org?.currency ?? "USD");

  async function saveCurrency() {
    setSaving(true);
    try {
      await apiPatch("/api/organizations/settings", { currency });
      await refresh();
      toast.success("Currency updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update currency");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" /> Organization Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Name</p>
              <p className="font-medium">{org?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Slug</p>
              <p className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">{org?.slug}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Plan</p>
              <p className="font-medium capitalize">{org?.plan}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Status</p>
              <Badge
                variant="outline"
                className={cn("text-xs capitalize", org?.status === "trial"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700")}
              >
                {org?.status}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Seat limit</p>
              <p className="font-medium">{org?.userCount} users</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Members</p>
              <p className="font-medium">{org?.members.length ?? 0} active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-muted-foreground" /> System Currency
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The default currency used across invoices, expenses, and financial reports.
          </p>
          <div className="flex items-center gap-3">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={!isOwner}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {CURRENCIES.map(({ code, label }) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
            {isOwner && (
              <Button size="sm" onClick={() => void saveCurrency()} disabled={saving || !isDirty}>
                {saving ? "Saving…" : "Save"}
              </Button>
            )}
          </div>
          {!isOwner && (
            <p className="text-[11px] text-muted-foreground">Only owners can change the system currency.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

const ALL_ROLES: OrgRole[] = [
  "owner", "manager", "sales_leader", "inventory_manager", "accountant", "engineer", "service_agent", "member",
];

function RoleBadge({ role }: { role: OrgRole }) {
  const Icon = ROLE_ICON[role] ?? UserCircle;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border", ROLE_COLOR[role])}>
      <Icon className="w-3 h-3" /> {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function RoleSelector({ current, onChange, disabled, roles: rolesProp }: { current: OrgRole; onChange: (r: OrgRole) => void; disabled?: boolean; roles?: OrgRole[] }) {
  const [open, setOpen] = useState(false);
  const roles = rolesProp ?? ALL_ROLES;
  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors",
          ROLE_COLOR[current] ?? ROLE_COLOR.member,
          !disabled && "cursor-pointer hover:opacity-80",
          disabled && "opacity-60 cursor-default"
        )}
      >
        {ROLE_LABEL[current] ?? current} <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg py-1 min-w-[160px]">
          {roles.map((r) => {
            const Icon = ROLE_ICON[r] ?? UserCircle;
            return (
              <button
                key={r}
                onClick={() => { onChange(r); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                  r === current && "font-semibold"
                )}
              >
                <Icon className={cn("w-3 h-3", r === current ? "" : "text-muted-foreground")} />
                {ROLE_LABEL[r] ?? r}
                {r === current && <Check className="w-3 h-3 ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Role definitions for reference display ────────────────────────────────────

const ROLE_DEFINITIONS: {
  role: OrgRole; icon: typeof Crown; color: string; description: string; permissions: string[];
}[] = [
  {
    role:  "owner",
    icon:  Crown,
    color: ROLE_COLOR.owner,
    description: "Full control over the organization.",
    permissions: [
      "Add members directly (name, email, password & role)",
      "Change any member's role or remove members",
      "Access all installed modules",
      "Configure team-based module access",
      "Create and revoke API keys",
      "Manage webhooks and integrations",
      "Invite members via email",
      "Create and manage teams",
    ],
  },
  {
    role:  "manager",
    icon:  Shield,
    color: ROLE_COLOR.manager,
    description: "Org-wide management across all teams.",
    permissions: [
      "Access all installed modules",
      "Invite members via email",
      "Create, update, and delete teams",
      "Assign team leaders and team members",
      "View full member list",
    ],
  },
  {
    role:  "sales_leader",
    icon:  TrendingUp,
    color: ROLE_COLOR.sales_leader,
    description: "Leads the sales team and CRM operations.",
    permissions: [
      "Access CRM and sales modules (via team)",
      "View and manage sales leads and deals",
      "View team assignments",
    ],
  },
  {
    role:  "inventory_manager",
    icon:  Package,
    color: ROLE_COLOR.inventory_manager,
    description: "Manages inventory, stock, and warehouse.",
    permissions: [
      "Access inventory module (via team)",
      "Manage products, warehouses, and stock levels",
      "View and create purchase orders",
    ],
  },
  {
    role:  "accountant",
    icon:  Calculator,
    color: ROLE_COLOR.accountant,
    description: "Handles invoices, expenses, and finances.",
    permissions: [
      "Access accounting module (via team)",
      "Create and manage invoices and expenses",
      "View revenue and financial reports",
    ],
  },
  {
    role:  "engineer",
    icon:  Wrench,
    color: ROLE_COLOR.engineer,
    description: "Works on engineering and project tasks.",
    permissions: [
      "Access projects and engineering modules (via team)",
      "Manage tasks, assignees, and priorities",
      "View project progress and timelines",
    ],
  },
  {
    role:  "service_agent",
    icon:  HeadphonesIcon,
    color: ROLE_COLOR.service_agent,
    description: "Handles customer service and support.",
    permissions: [
      "Access service and CRM modules (via team)",
      "View and manage customer interactions",
      "Log service activities and follow-ups",
    ],
  },
  {
    role:  "member",
    icon:  UserCircle,
    color: ROLE_COLOR.member,
    description: "Standard access based on team assignments.",
    permissions: [
      "Access modules via team membership only",
      "View own profile and update password",
      "View team assignments",
    ],
  },
];

function RoleReferenceCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" /> Role Reference
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Each role defines what a member can do. Module access for specialized roles is granted via team membership.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_DEFINITIONS.map(({ role, icon: Icon, color, description, permissions }) => (
            <div key={role} className={cn("rounded-lg border p-3 space-y-2", color)}>
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-semibold">{ROLE_LABEL[role] ?? role}</span>
              </div>
              <p className="text-[11px] opacity-80">{description}</p>
              <ul className="space-y-1">
                {permissions.map((p) => (
                  <li key={p} className="flex items-start gap-1.5 text-[11px]">
                    <Check className="w-3 h-3 mt-0.5 shrink-0 opacity-70" />
                    <span className="opacity-80">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MembersTab() {
  const { user, role } = useAuth();
  const isOwner   = role === "owner";
  const isManager = role === "owner" || role === "manager";

  const [members, setMembers]   = useState<Member[]>([]);
  const [invites, setInvites]   = useState<InviteRecord[]>([]);
  const [email, setEmail]       = useState("");
  const [invRole, setInvRole]   = useState<OrgRole>("member");
  const [sending, setSending]   = useState(false);

  // Direct-add form state (owner-only)
  const [addForm, setAddForm]   = useState({ name: "", email: "", password: "", role: "member" as OrgRole });
  const [showPass, setShowPass] = useState(false);
  const [adding, setAdding]     = useState(false);

  // Dynamic role list from config (member_roles list, excludes owner)
  const [dynamicRoles, setDynamicRoles] = useState<OrgRole[]>(ALL_ROLES.filter((r) => r !== "owner"));

  // Inline member edit
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm, setEditForm]     = useState({ name: "", email: "", password: "", role: "member" as OrgRole });
  const [editSaving, setEditSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      const d = await apiGet<{ members: Member[] }>("/api/org/members");
      setMembers(d.members);
    } catch { /* ignore */ }
  }, []);

  const loadInvites = useCallback(async () => {
    try {
      const d = await apiGet<{ invites: InviteRecord[] }>("/api/org/invites");
      setInvites(d.invites);
    } catch { /* member-level sees nothing */ }
  }, []);

  const loadDynamicRoles = useCallback(async () => {
    try {
      const d = await apiGet<{ list: ConfigList }>("/api/org/config/member_roles");
      const roles = (d.list?.items ?? []).map((i: ConfigItem) => i.value as OrgRole);
      if (roles.length > 0) setDynamicRoles(roles);
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => { void loadMembers(); void loadInvites(); void loadDynamicRoles(); }, [loadMembers, loadInvites, loadDynamicRoles]);

  async function changeRole(memberId: string, newRole: OrgRole) {
    try {
      const d = await apiPatch<{ member: Member }>(`/api/org/members/${memberId}/role`, { role: newRole });
      setMembers((ms) => ms.map((m) => m.id === memberId ? d.member : m));
      toast.success("Role updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function removeMember(memberId: string) {
    try {
      await apiDelete(`/api/org/members/${memberId}`);
      setMembers((ms) => ms.filter((m) => m.id !== memberId));
      toast.success("Member removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function saveMemberEdit(memberId: string) {
    setEditSaving(true);
    try {
      const payload: Record<string, string> = { role: editForm.role };
      if (editForm.name.trim())  payload.name  = editForm.name.trim();
      if (editForm.email.trim()) payload.email = editForm.email.trim();
      if (editForm.password)     payload.password = editForm.password;
      const d = await apiPatch<{ member: Member }>(`/api/org/members/${memberId}`, payload);
      setMembers((ms) => ms.map((m) => m.id === memberId ? d.member : m));
      setEditingId(null);
      toast.success("Member updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update member");
    } finally { setEditSaving(false); }
  }

  async function sendInvite() {
    if (!email.trim()) return;
    setSending(true);
    try {
      const d = await apiPost<{ invite: InviteRecord }>("/api/org/invites", { email: email.trim(), role: invRole });
      setInvites((p) => [d.invite, ...p]);
      setEmail("");
      toast.success("Invite sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally { setSending(false); }
  }

  async function cancelInvite(id: string) {
    try {
      await apiDelete(`/api/org/invites/${id}`);
      setInvites((p) => p.filter((i) => i.id !== id));
      toast.success("Invite cancelled.");
    } catch { toast.error("Failed to cancel invite"); }
  }

  async function addMemberDirectly(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) return;
    setAdding(true);
    try {
      const d = await apiPost<{ member: Member }>("/api/org/members", addForm);
      setMembers((ms) => [...ms, d.member]);
      setAddForm({ name: "", email: "", password: "", role: "member" });
      toast.success(`${d.member.user.name} added to the organization.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally { setAdding(false); }
  }

  return (
    <div className="space-y-6">
      {/* Member list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Team Members
            <span className="ml-auto text-xs text-muted-foreground font-normal">{members.length} members</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.map((m, i) => {
            const isSelf      = m.user.id === user?.id;
            const canChange   = isOwner && !isSelf;
            const isEditing   = editingId === m.id;
            const selectorRoles: OrgRole[] = ["owner", ...dynamicRoles];
            return (
              <div key={m.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">{m.user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      {m.user.name}
                      {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                  </div>
                  <RoleSelector current={m.role} onChange={(r) => void changeRole(m.id, r)} disabled={!canChange} roles={selectorRoles} />
                  {canChange && (
                    <button
                      onClick={() => {
                        if (isEditing) { setEditingId(null); return; }
                        setEditingId(m.id);
                        setEditForm({ name: m.user.name, email: m.user.email, password: "", role: m.role });
                      }}
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        isEditing ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                      title={isEditing ? "Close editor" : "Edit member details"}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isOwner && !isSelf && (
                    <button
                      onClick={() => void removeMember(m.id)}
                      className="p-1.5 rounded hover:bg-destructive/10 text-destructive/50 hover:text-destructive transition-colors"
                      title="Remove member"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {isEditing && (
                  <div className="mx-6 mb-3 rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Full Name</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Email</Label>
                        <Input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">
                          New Password <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Input
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                          placeholder="Leave blank to keep current"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Role</Label>
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as OrgRole }))}
                          className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          {selectorRoles.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8" onClick={() => void saveMemberEdit(m.id)} disabled={editSaving}>
                        {editSaving ? "Saving…" : "Save Changes"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Add member directly — owner only */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-muted-foreground" /> Add Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Create a user account directly and add them to the organization — no invitation email required.
            </p>
            <form onSubmit={(e) => void addMemberDirectly(e)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Full Name</Label>
                  <Input
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith"
                    className="h-8 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Email</Label>
                  <Input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="jane@company.com"
                    className="h-8 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      value={addForm.password}
                      onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      className="h-8 text-sm pr-8"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Role</Label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as OrgRole }))}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {(["owner", ...dynamicRoles] as OrgRole[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" className="h-8" disabled={adding}>
                  <Lock className="w-3.5 h-3.5 mr-1.5" />
                  {adding ? "Adding…" : "Add Member"}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  If the email already exists on the platform, the existing account is added to this org.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite via email — manager+ */}
      {isManager && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" /> Invite via Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Send an email invitation. The recipient will receive a link to join your organization.
            </p>
            <div className="flex gap-2">
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com" className="text-sm h-8"
                onKeyDown={(e) => { if (e.key === "Enter") void sendInvite(); }}
              />
              <select
                value={invRole} onChange={(e) => setInvRole(e.target.value as OrgRole)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {dynamicRoles.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
                ))}
              </select>
              <Button size="sm" className="h-8 shrink-0" onClick={() => void sendInvite()} disabled={sending || !email.trim()}>
                <Mail className="w-3.5 h-3.5 mr-1" />{sending ? "Sending…" : "Invite"}
              </Button>
            </div>

            {invites.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending invites</p>
                <div className="divide-y divide-border rounded-lg border">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-3 px-3 py-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{inv.email}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => void cancelInvite(inv.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {invites.length === 0 && <p className="text-xs text-muted-foreground italic">No pending invites.</p>}
          </CardContent>
        </Card>
      )}

      {/* Role reference — visible to all */}
      <RoleReferenceCard />
    </div>
  );
}

// ─── Module Access Tab ────────────────────────────────────────────────────────

// Toggle color per role (for the matrix checkboxes)
const ROLE_TOGGLE_COLOR: Record<string, string> = {
  manager:           "bg-blue-500 border-blue-500",
  sales_leader:      "bg-emerald-500 border-emerald-500",
  inventory_manager: "bg-orange-500 border-orange-500",
  accountant:        "bg-amber-500 border-amber-500",
  engineer:          "bg-cyan-500 border-cyan-500",
  service_agent:     "bg-rose-500 border-rose-500",
  member:            "bg-slate-500 border-slate-500",
};

function ModuleAccessTab() {
  const { org } = useAuth();

  // access map: { [moduleKey]: { [role]: boolean } }
  const [access,     setAccess]     = useState<Record<string, Record<string, boolean>>>({});
  // roles read from the member_roles config list (ordered)
  const [roleKeys,   setRoleKeys]   = useState<string[]>([]);
  const [saving,     setSaving]     = useState(false);
  const [loaded,     setLoaded]     = useState(false);

  const modules: InstalledModule[] = org?.modules ?? [];

  useEffect(() => {
    Promise.all([
      apiGet<{ moduleAccess: Record<string, Record<string, boolean>> }>("/api/org/module-access"),
      apiGet<{ list: ConfigList }>("/api/org/config/member_roles").catch(() => ({ list: null })),
    ]).then(([accessData, roleData]) => {
      // Build role column list from config list; fall back to defaults
      const roles = (roleData.list?.items ?? []).map((i: ConfigItem) => i.value);
      const cols  = roles.length > 0
        ? roles
        : ["manager", "sales_leader", "inventory_manager", "accountant", "engineer", "service_agent", "member"];
      setRoleKeys(cols);

      // Build access map with defaults: manager=true, others=false
      const base: Record<string, Record<string, boolean>> = {};
      modules.forEach(({ moduleKey }) => {
        base[moduleKey] = {};
        cols.forEach((r) => {
          base[moduleKey][r] = accessData.moduleAccess[moduleKey]?.[r] ?? (r === "manager");
        });
      });
      setAccess(base);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(moduleKey: string, role: string) {
    setAccess((a) => ({
      ...a,
      [moduleKey]: { ...a[moduleKey], [role]: !a[moduleKey]?.[role] },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      await apiPut("/api/org/module-access", { moduleAccess: access });
      toast.success("Module access saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>;

  // Total columns = Module label + Owner (fixed) + roleKeys
  const colCount = 1 + 1 + roleKeys.length;
  const gridCols = `180px repeat(${colCount - 1}, 1fr)`;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 space-y-1">
        <p className="font-semibold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> How access works</p>
        <p>
          <span className="font-medium">Owners &amp; Managers</span> always have full access.
          For all other roles, enable the toggle to grant access.
          Members can also gain access via <span className="font-medium">Teams</span> — useful for cross-functional assignments.
          Edit the role list in <span className="font-medium">Configuration → Member Roles</span>.
        </p>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div style={{ minWidth: `${180 + colCount * 72}px` }}>
            {/* Header */}
            <div className="border-b px-4 py-2.5" style={{ display: "grid", gridTemplateColumns: gridCols }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Module</p>
              {/* Owner — always on */}
              <div className="flex flex-col items-center gap-0.5">
                <Crown className="w-3 h-3 text-violet-600" />
                <span className="text-[10px] font-semibold text-violet-700">Owner</span>
              </div>
              {roleKeys.map((r) => {
                const Icon = ROLE_ICON[r] ?? UserCircle;
                return (
                  <div key={r} className="flex flex-col items-center gap-0.5">
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight">
                      {ROLE_LABEL[r] ?? r}
                    </span>
                  </div>
                );
              })}
            </div>

            {modules.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No modules installed. Visit the <span className="font-medium">Store</span> to install modules.
              </div>
            )}

            {modules.map(({ moduleKey }, i) => (
              <div key={moduleKey}>
                {i > 0 && <Separator />}
                <div className="px-4 py-3 items-center" style={{ display: "grid", gridTemplateColumns: gridCols }}>
                  <div>
                    <p className="text-sm font-medium">{MODULE_LABELS[moduleKey] ?? moduleKey}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{moduleKey}</p>
                  </div>
                  {/* Owner — always checked, not toggleable */}
                  <div className="flex justify-center">
                    <div className="w-4 h-4 rounded bg-violet-100 border border-violet-300 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-violet-600" />
                    </div>
                  </div>
                  {/* Role toggles */}
                  {roleKeys.map((r) => (
                    <div key={r} className="flex justify-center">
                      <button
                        onClick={() => toggle(moduleKey, r)}
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                          access[moduleKey]?.[r]
                            ? (ROLE_TOGGLE_COLOR[r] ?? "bg-primary border-primary")
                            : "border-muted-foreground/30 hover:border-muted-foreground/60"
                        )}
                        title={`${access[moduleKey]?.[r] ? "Revoke" : "Grant"} ${ROLE_LABEL[r] ?? r} access to ${MODULE_LABELS[moduleKey] ?? moduleKey}`}
                      >
                        {access[moduleKey]?.[r] && <Check className="w-2.5 h-2.5 text-white" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Changes take effect immediately for new requests.
          Add/remove role columns in <span className="font-medium">Configuration → Member Roles</span>.
        </p>
      </div>
    </div>
  );
}

// ─── Teams Tab ────────────────────────────────────────────────────────────────

function TeamCard({
  team,
  members,
  isManager,
  onUpdate,
  onDelete,
}: {
  team:      Team;
  members:   Member[];
  isManager: boolean;
  onUpdate:  (t: Team) => void;
  onDelete:  (id: string) => void;
}) {
  const [addMemberId, setAddMemberId] = useState("");
  const assignedIds = new Set(team.members.map((tm) => tm.member.id));
  const unassigned  = members.filter((m) => !assignedIds.has(m.id));

  async function setLeader(leaderId: string) {
    try {
      const d = await apiPatch<{ team: Team }>(`/api/org/teams/${team.id}`, { leaderId: leaderId || null });
      onUpdate(d.team);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update leader"); }
  }

  async function addMember() {
    if (!addMemberId) return;
    try {
      await apiPost(`/api/org/teams/${team.id}/members`, { memberId: addMemberId });
      const d = await apiGet<{ teams: Team[] }>("/api/org/teams");
      const updated = d.teams.find((t) => t.id === team.id);
      if (updated) onUpdate(updated);
      setAddMemberId("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add member"); }
  }

  async function removeMember(memberId: string) {
    try {
      await apiDelete(`/api/org/teams/${team.id}/members/${memberId}`);
      onUpdate({ ...team, members: team.members.filter((tm) => tm.member.id !== memberId) });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to remove"); }
  }

  async function deleteTeam() {
    try {
      await apiDelete(`/api/org/teams/${team.id}`);
      onDelete(team.id);
      toast.success("Team deleted.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete team"); }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{team.name}</CardTitle>
            <Badge variant="outline" className="mt-1 text-[10px] capitalize font-mono">
              {MODULE_LABELS[team.moduleKey] ?? team.moduleKey}
            </Badge>
          </div>
          {isManager && (
            <button
              onClick={() => void deleteTeam()}
              className="p-1.5 rounded hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team Leader */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Crown className="w-3 h-3" /> Team Leader
          </p>
          {isManager ? (
            <select
              value={team.leaderId ?? ""}
              onChange={(e) => void setLeader(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— No leader —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.user.name} ({m.role})</option>
              ))}
            </select>
          ) : (
            <p className="text-sm">{team.leader?.user.name ?? <span className="text-muted-foreground italic">Not assigned</span>}</p>
          )}
        </div>

        {/* Team Members */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Members ({team.members.length})
          </p>
          {team.members.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No members assigned.</p>
          )}
          <div className="space-y-1">
            {team.members.map((tm) => (
              <div key={tm.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-primary">{tm.member.user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{tm.member.user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate capitalize">{tm.member.role}</p>
                </div>
                {tm.member.id === team.leaderId && (
                  <Crown className="w-3 h-3 text-amber-500" />
                )}
                {isManager && (
                  <button
                    onClick={() => void removeMember(tm.member.id)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isManager && (
            <div className="flex gap-2 mt-2">
              <select
                value={addMemberId}
                onChange={(e) => setAddMemberId(e.target.value)}
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Add a member…</option>
                {unassigned.map((m) => (
                  <option key={m.id} value={m.id}>{m.user.name}</option>
                ))}
              </select>
              <Button size="sm" className="h-8 shrink-0" onClick={() => void addMember()} disabled={!addMemberId}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TeamsTab() {
  const { org, role } = useAuth();
  const isManager = role === "owner" || role === "manager";

  const [teams, setTeams]     = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [newModule, setNewModule] = useState("");
  const [creating, setCreating]   = useState(false);
  const [showForm, setShowForm]   = useState(false);

  const modules: InstalledModule[] = org?.modules ?? [];

  useEffect(() => {
    void apiGet<{ teams: Team[] }>("/api/org/teams").then((d) => setTeams(d.teams)).catch(() => {});
    void apiGet<{ members: Member[] }>("/api/org/members").then((d) => setMembers(d.members)).catch(() => {});
  }, []);

  async function createTeam() {
    if (!newName.trim() || !newModule) return;
    setCreating(true);
    try {
      const d = await apiPost<{ team: Team }>("/api/org/teams", { name: newName.trim(), moduleKey: newModule });
      setTeams((t) => [...t, d.team]);
      setNewName(""); setNewModule(""); setShowForm(false);
      toast.success("Team created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Organize members into teams with designated leaders.
        </p>
        {isManager && (
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Team
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Team Name</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Sales Team A" className="h-8 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Module</Label>
                <select
                  value={newModule} onChange={(e) => setNewModule(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select module…</option>
                  {modules.map(({ moduleKey }) => (
                    <option key={moduleKey} value={moduleKey}>{MODULE_LABELS[moduleKey] ?? moduleKey}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void createTeam()} disabled={creating || !newName.trim() || !newModule}>
                {creating ? "Creating…" : "Create Team"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {teams.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <Users className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No teams yet.</p>
          {isManager && <p className="text-xs text-muted-foreground mt-1">Click "New Team" to get started.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((t) => (
          <TeamCard
            key={t.id}
            team={t}
            members={members}
            isManager={isManager}
            onUpdate={(updated) => setTeams((ts) => ts.map((x) => x.id === updated.id ? updated : x))}
            onDelete={(id) => setTeams((ts) => ts.filter((x) => x.id !== id))}
          />
        ))}
      </div>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [keys, setKeys]           = useState<ApiKeyRecord[]>([]);
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [secret, setSecret]       = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    apiGet<{ keys: ApiKeyRecord[] }>("/api/org/api-keys").then((d) => setKeys(d.keys)).catch(() => {});
  }, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const d = await apiPost<{ key: ApiKeyRecord; secret: string }>("/api/org/api-keys", { name: newName.trim() });
      setKeys((k) => [d.key, ...k]);
      setSecret(d.secret);
      setShowSecret(true);
      setNewName("");
      toast.success("API key created — save the secret now.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create API key");
    } finally { setCreating(false); }
  }

  async function revoke(id: string) {
    try {
      await apiDelete(`/api/org/api-keys/${id}`);
      setKeys((k) => k.filter((x) => x.id !== id));
      toast.success("API key revoked.");
    } catch { toast.error("Failed to revoke API key"); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Programmatic access via{" "}
        <code className="bg-muted px-1 py-0.5 rounded text-[11px]">Authorization: Bearer &lt;key&gt;</code>.
        Keys have owner-level access.
      </p>

      {secret && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Save your secret key — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono bg-white border rounded px-2 py-1.5 break-all">
              {showSecret ? secret : "•".repeat(20)}
            </code>
            <button onClick={() => setShowSecret((s) => !s)} className="p-1.5 rounded hover:bg-amber-100 transition-colors">
              {showSecret ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-amber-700" />}
            </button>
            <button
              onClick={() => { void navigator.clipboard.writeText(secret!); toast.success("Copied!"); }}
              className="text-xs px-2 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-2">
            <Input
              value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Key name (e.g. CI/CD integration)"
              className="text-sm h-8"
              onKeyDown={(e) => { if (e.key === "Enter") void create(); }}
            />
            <Button size="sm" className="h-8 shrink-0" onClick={() => void create()} disabled={creating || !newName.trim()}>
              <Plus className="w-3.5 h-3.5 mr-1" />{creating ? "Creating…" : "Create"}
            </Button>
          </div>

          {keys.length === 0 && !secret && (
            <p className="text-xs text-muted-foreground italic">No API keys yet.</p>
          )}

          {keys.length > 0 && (
            <div className="divide-y divide-border rounded-lg border">
              {keys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{k.prefix}… · created {new Date(k.createdAt).toLocaleDateString()}</p>
                  </div>
                  {k.lastUsedAt && (
                    <span className="text-[10px] text-muted-foreground hidden sm:block">
                      used {new Date(k.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                  <button onClick={() => void revoke(k.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  "lead.created","lead.updated","lead.deleted",
  "deal.created","deal.updated",
  "invoice.created","invoice.updated",
  "member.invited","member.joined",
  "task.created","task.updated",
] as const;

type WebhookRecord = {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
  deliveries?: { id: string; event: string; statusCode: number | null; sentAt: string }[];
};

function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ url: "", secret: "", events: [] as string[] });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    apiGet<{ webhooks: WebhookRecord[] }>("/api/webhooks")
      .then((r) => setWebhooks(r.webhooks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleEvent(event: string) {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
    }));
  }

  async function createWebhook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiPost<{ webhook: WebhookRecord }>("/api/webhooks", form);
      setWebhooks((w) => [data.webhook, ...w]);
      setShowForm(false);
      setForm({ url: "", secret: "", events: [] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create webhook");
    } finally { setSaving(false); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    await apiPatch(`/api/webhooks/${id}`, { isActive: !isActive }).catch(() => {});
    setWebhooks((w) => w.map((wh) => wh.id === id ? { ...wh, isActive: !isActive } : wh));
  }

  async function deleteWebhook(id: string) {
    await apiDelete(`/api/webhooks/${id}`).catch(() => {});
    setWebhooks((w) => w.filter((wh) => wh.id !== id));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="w-4 h-4 text-muted-foreground" /> Webhook Endpoints
          </CardTitle>
          <Button size="sm" onClick={() => setShowForm((s) => !s)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Webhook
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Webhooks allow external systems to receive real-time events from Business360.
            All POST requests include a <code className="bg-muted px-1 rounded">X-Business360-Signature</code> header
            (HMAC SHA-256 if a secret is configured).
          </p>

          {showForm && (
            <form onSubmit={createWebhook} className="rounded-xl border bg-muted/20 p-4 space-y-4">
              <div>
                <Label className="text-xs font-semibold">Endpoint URL *</Label>
                <Input
                  className="mt-1.5"
                  placeholder="https://example.com/webhook"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Secret (optional)</Label>
                <Input
                  className="mt-1.5"
                  placeholder="min 8 chars — used to sign payloads"
                  value={form.secret}
                  onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))}
                  type="password"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-2 block">Events (empty = all)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEBHOOK_EVENTS.map((ev) => (
                    <button
                      key={ev}
                      type="button"
                      onClick={() => toggleEvent(ev)}
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full border font-mono transition-all",
                        form.events.includes(ev)
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {ev}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Creating…" : "Create Webhook"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {!loading && webhooks.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <Webhook className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
              No webhooks configured
            </div>
          )}

          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", wh.isActive ? "bg-emerald-500" : "bg-muted-foreground/30")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono font-medium truncate">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {wh.events.length === 0 ? (
                      <Badge variant="outline" className="text-[10px]">All events</Badge>
                    ) : wh.events.map((ev) => (
                      <Badge key={ev} variant="outline" className="text-[10px] font-mono">{ev}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(wh.id, wh.isActive)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all",
                      wh.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {wh.isActive ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => deleteWebhook(wh.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive/60 hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {wh.deliveries && wh.deliveries.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent deliveries</p>
                  {wh.deliveries.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 text-[11px]">
                      {d.statusCode && d.statusCode < 300
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        : <AlertCircle  className="w-3 h-3 text-amber-500 shrink-0" />
                      }
                      <span className="font-mono text-muted-foreground">{d.event}</span>
                      <span className={cn("ml-auto font-mono", d.statusCode && d.statusCode < 300 ? "text-emerald-600" : "text-amber-600")}>
                        {d.statusCode ?? "error"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Configuration Tab ────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b",
];

function ListItemRow({
  item, isManager, onSave, onDelete,
}: {
  item: ConfigItem; isManager: boolean;
  onSave: (id: string, value: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing]   = useState(false);
  const [val, setVal]           = useState(item.value);
  const [saving, setSaving]     = useState(false);

  async function save() {
    if (!val.trim() || val === item.value) { setEditing(false); return; }
    setSaving(true);
    await onSave(item.id, val.trim());
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 group hover:bg-muted/40 rounded-md">
      {item.color && (
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
      )}
      {editing ? (
        <input
          autoFocus
          className="flex-1 text-sm bg-transparent border-b border-primary outline-none"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
          onBlur={() => void save()}
        />
      ) : (
        <span className="flex-1 text-sm">{item.value}</span>
      )}
      {isManager && !editing && (
        <div className="hidden group-hover:flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Settings2 className="w-3 h-3" />
          </button>
          <button onClick={() => void onDelete(item.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {saving && <span className="text-[10px] text-muted-foreground">saving…</span>}
    </div>
  );
}

function ListEditor({ list, isManager, onChange }: { list: ConfigList; isManager: boolean; onChange: (l: ConfigList) => void }) {
  const [newValue, setNewValue]   = useState("");
  const [newColor, setNewColor]   = useState<string>("");
  const [adding, setAdding]       = useState(false);
  const [showColor, setShowColor] = useState(false);

  async function addItem() {
    if (!newValue.trim()) return;
    setAdding(true);
    try {
      const d = await apiPost<{ item: ConfigItem }>(`/api/org/config/${list.key}/items`, {
        value: newValue.trim(), color: newColor || undefined,
      });
      onChange({ ...list, items: [...list.items, d.item] });
      setNewValue(""); setNewColor("");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to add item"); }
    finally { setAdding(false); }
  }

  async function saveItem(id: string, value: string) {
    try {
      const d = await apiPatch<{ item: ConfigItem }>(`/api/org/config/${list.key}/items/${id}`, { value });
      onChange({ ...list, items: list.items.map((i) => i.id === id ? d.item : i) });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to update item"); }
  }

  async function deleteItem(id: string) {
    try {
      await apiDelete(`/api/org/config/${list.key}/items/${id}`);
      onChange({ ...list, items: list.items.filter((i) => i.id !== id) });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete item"); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm font-semibold">{list.label}</p>
          {list.description && <p className="text-xs text-muted-foreground">{list.description}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{list.items.length} items</span>
          {list.isSystem && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">System</Badge>
          )}
        </div>
      </div>

      <div className="rounded-lg border divide-y divide-border min-h-[40px]">
        {list.items.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground italic text-center">No items yet. Add the first one below.</p>
        )}
        {list.items.map((item) => (
          <ListItemRow key={item.id} item={item} isManager={isManager} onSave={saveItem} onDelete={deleteItem} />
        ))}
      </div>

      {isManager && (
        <div className="flex gap-2 items-center">
          {showColor && (
            <div className="flex gap-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => { setNewColor(c); setShowColor(false); }}
                  className={cn("w-4 h-4 rounded-full border-2 transition-transform hover:scale-110",
                    newColor === c ? "border-foreground" : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
              <button onClick={() => { setNewColor(""); setShowColor(false); }} className="text-[10px] text-muted-foreground hover:text-foreground">
                none
              </button>
            </div>
          )}
          {newColor && !showColor && (
            <button onClick={() => setShowColor(true)}>
              <span className="w-4 h-4 rounded-full inline-block border border-border" style={{ background: newColor }} />
            </button>
          )}
          {!newColor && !showColor && (
            <button onClick={() => setShowColor(true)} className="p-1.5 rounded border border-dashed border-muted-foreground/40 hover:border-muted-foreground transition-colors" title="Pick color">
              <span className="w-2.5 h-2.5 rounded-full block bg-gradient-to-br from-violet-400 to-emerald-400" />
            </button>
          )}
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Add to ${list.label}…`}
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => { if (e.key === "Enter") void addItem(); }}
          />
          <Button size="sm" className="h-8 shrink-0" onClick={() => void addItem()} disabled={adding || !newValue.trim()}>
            <Plus className="w-3.5 h-3.5 mr-1" />{adding ? "Adding…" : "Add"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ConfigurationTab() {
  const { role } = useAuth();
  const isManager = role === "owner" || role === "manager";

  const [lists, setLists]         = useState<ConfigList[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);

  // New list form
  const [showNewList, setShowNewList] = useState(false);
  const [newLabel, setNewLabel]       = useState("");
  const [newKey, setNewKey]           = useState("");
  const [newDesc, setNewDesc]         = useState("");
  const [creating, setCreating]       = useState(false);

  useEffect(() => {
    apiGet<{ lists: ConfigList[] }>("/api/org/config")
      .then((d) => {
        setLists(d.lists);
        if (d.lists.length > 0 && !activeKey) setActiveKey(d.lists[0]?.key ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateList(updated: ConfigList) {
    setLists((ls) => ls.map((l) => l.key === updated.key ? updated : l));
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newKey.trim()) return;
    setCreating(true);
    try {
      const d = await apiPost<{ list: ConfigList }>("/api/org/config", {
        key: newKey.trim(), label: newLabel.trim(), description: newDesc.trim() || undefined,
      });
      setLists((ls) => [...ls, d.list]);
      setActiveKey(d.list.key);
      setShowNewList(false); setNewLabel(""); setNewKey(""); setNewDesc("");
      toast.success("List created.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create list"); }
    finally { setCreating(false); }
  }

  async function deleteList(key: string) {
    try {
      await apiDelete(`/api/org/config/${key}`);
      const remaining = lists.filter((l) => l.key !== key);
      setLists(remaining);
      setActiveKey(remaining[0]?.key ?? null);
      toast.success("List deleted.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to delete list"); }
  }

  const activeList = lists.find((l) => l.key === activeKey) ?? null;

  if (loading) return <p className="text-sm text-muted-foreground">Loading configuration…</p>;

  return (
    <div className="flex gap-4 min-h-[500px]">
      {/* Sidebar */}
      <div className="w-52 shrink-0 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 mb-2">Lists</p>
        {lists.map((list) => (
          <button
            key={list.key}
            onClick={() => setActiveKey(list.key)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors",
              activeKey === list.key
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            )}
          >
            <span className="flex-1 truncate">{list.label}</span>
            <span className={cn(
              "text-[10px] tabular-nums shrink-0",
              activeKey === list.key ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {list.items.length}
            </span>
          </button>
        ))}

        {isManager && (
          <button
            onClick={() => setShowNewList((s) => !s)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-dashed border-muted-foreground/30 mt-2"
          >
            <Plus className="w-3.5 h-3.5" /> New List
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* New list form */}
        {showNewList && (
          <Card className="border-dashed">
            <CardContent className="pt-4">
              <form onSubmit={(e) => void createList(e)} className="space-y-3">
                <p className="text-sm font-semibold">New List</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Label</Label>
                    <Input value={newLabel} onChange={(e) => { setNewLabel(e.target.value); if (!newKey) setNewKey(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")); }} placeholder="e.g. Payment Terms" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Key (unique identifier)</Label>
                    <Input value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="e.g. payment_terms" className="h-8 text-sm font-mono" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Description (optional)</Label>
                  <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What this list is used for" className="h-8 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={creating || !newLabel.trim() || !newKey.trim()}>
                    {creating ? "Creating…" : "Create List"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowNewList(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {activeList ? (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between mb-4">
                <div />
                {isManager && !activeList.isSystem && (
                  <button
                    onClick={() => void deleteList(activeList.key)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-destructive/40 hover:text-destructive transition-colors"
                    title="Delete list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <ListEditor list={activeList} isManager={isManager} onChange={updateList} />
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <Settings2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Select a list from the sidebar</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("account");

  const isOwner   = role === "owner";
  const isManager = role === "owner" || role === "manager";

  const visibleTabs = TABS.filter((t) => {
    if (t.ownerOnly   && !isOwner)   return false;
    if (t.managerPlus && !isManager) return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-muted-foreground" /> Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account, team, and organization settings.</p>
      </div>

      {/* Tab nav */}
      <div className="border-b">
        <nav className="flex gap-0.5 -mb-px flex-wrap">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "account"       && <AccountTab />}
        {activeTab === "organization"  && <OrganizationTab />}
        {activeTab === "members"       && <MembersTab />}
        {activeTab === "module-access" && <ModuleAccessTab />}
        {activeTab === "teams"         && <TeamsTab />}
        {activeTab === "configuration" && <ConfigurationTab />}
        {activeTab === "api-keys"      && <ApiKeysTab />}
        {activeTab === "webhooks"      && <WebhooksTab />}
      </div>
    </div>
  );
}
