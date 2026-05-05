"use client";

import { useState } from "react";
import { User, Building2, Crown, Shield, UserCircle, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { apiPost } from "@/lib/api";

const ROLE_COLOR: Record<string, string> = {
  owner:  "border-violet-200 bg-violet-50 text-violet-700",
  admin:  "border-blue-200 bg-blue-50 text-blue-700",
  member: "border-border bg-muted text-muted-foreground",
};

const ROLE_ICON: Record<string, typeof Crown> = {
  owner:  Crown,
  admin:  Shield,
  member: UserCircle,
};

function PasswordChangeForm() {
  const [form, setForm]       = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); setSuccess(false); setError(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { setError("New passwords do not match"); return; }
    if (form.newPassword.length < 8) { setError("New password must be at least 8 characters"); return; }
    setSaving(true); setError(null);
    try {
      await apiPost("/api/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword:     form.newPassword,
      });
      setSuccess(true);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">Password changed successfully.</p>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Current Password</Label>
        <Input
          type="password" value={form.currentPassword}
          onChange={(e) => set("currentPassword", e.target.value)}
          placeholder="Enter current password" required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">New Password</Label>
          <Input
            type="password" value={form.newPassword}
            onChange={(e) => set("newPassword", e.target.value)}
            placeholder="Min 8 characters" required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Confirm New Password</Label>
          <Input
            type="password" value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            placeholder="Repeat new password" required
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Changing…" : "Change Password"}
      </Button>
    </form>
  );
}

export default function SettingsPage() {
  const { user, org, role } = useAuth();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">Manage your account and organization.</p>
      </div>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
            {role && (
              <Badge variant="outline" className={cn("text-xs capitalize", ROLE_COLOR[role] ?? ROLE_COLOR.member)}>
                {role}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Password change */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-muted-foreground" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>

      {/* Organization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Organization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-1">Name</p>
              <p className="font-medium">{org?.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Slug</p>
              <p className="font-mono text-xs bg-muted px-2 py-1 rounded">{org?.slug}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Plan</p>
              <p className="font-medium capitalize">{org?.plan}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">Status</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  org?.status === "trial"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                {org?.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Members
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              {org?.members.length ?? 0} / {org?.userCount ?? 1}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {org?.members.map((m, i) => {
            const RoleIcon = ROLE_ICON[m.role] ?? UserCircle;
            return (
              <div key={m.id}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-6 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {m.user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs capitalize shrink-0", ROLE_COLOR[m.role] ?? ROLE_COLOR.member)}>
                    <RoleIcon className="w-3 h-3 mr-1" />
                    {m.role}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
