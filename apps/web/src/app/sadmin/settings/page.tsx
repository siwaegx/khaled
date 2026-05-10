"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, Save, AlertTriangle, Megaphone, DollarSign, Clock, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

type Settings = {
  planPrices: { starter: number; growth: number; pro: number; enterprise: number };
  trialDays: number;
  maintenanceMode: boolean;
  announcement: string;
};

const PLAN_COLORS: Record<string, string> = {
  starter:    "text-emerald-400",
  growth:     "text-blue-400",
  pro:        "text-violet-400",
  enterprise: "text-amber-400",
};

function NumberInput({
  label, value, min, max, step = 1, prefix, suffix, onChange,
}: {
  label: string; value: number; min?: number; max?: number;
  step?: number; prefix?: string; suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-[12px] text-slate-600">{prefix}</span>}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) onChange(n);
          }}
          className="w-28 h-8 px-2.5 text-[13px] font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500/50 [appearance:textfield]"
        />
        {suffix && <span className="text-[12px] text-slate-600">{suffix}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings]   = useState<Settings | null>(null);
  const [draft, setDraft]         = useState<Settings | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ settings: Settings }>("/api/sadmin/settings");
      setSettings(res.settings);
      setDraft(res.settings);
    } catch { toast.error("Failed to load settings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function updateDraftPrice(plan: keyof Settings["planPrices"], value: number) {
    if (!draft) return;
    setDraft({ ...draft, planPrices: { ...draft.planPrices, [plan]: value } });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await apiPatch<{ settings: Settings }>("/api/sadmin/settings", draft);
      setSettings(res.settings);
      setDraft(res.settings);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save settings"); }
    finally { setSaving(false); }
  }

  function handleReset() {
    if (!settings) return;
    setDraft(settings);
    toast("Reset to last saved values");
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  if (loading || !draft) {
    return (
      <div className="space-y-5 max-w-2xl">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-slate-800 animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Platform Settings</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">Changes apply immediately — settings reset on server restart</p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleReset}
              className="h-8 px-3 text-[12px] border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              Reset
            </button>
          )}
          <Button
            onClick={() => void handleSave()}
            disabled={saving || !isDirty}
            size="sm"
            className={cn(
              "h-8 text-[12px] transition-all",
              isDirty
                ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60"
            )}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}
            className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700">
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[12px] text-amber-400 font-medium">You have unsaved changes</span>
        </div>
      )}

      {/* Plan Pricing */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            Plan Pricing
          </CardTitle>
          <p className="text-[11px] text-slate-600 mt-0.5">Monthly price per plan in USD. Used to calculate MRR across the platform.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-2 gap-5">
            {(["starter", "growth", "pro", "enterprise"] as const).map((plan) => (
              <div key={plan}>
                <label className={cn("block text-[11px] font-semibold uppercase tracking-wider mb-1.5 capitalize", PLAN_COLORS[plan])}>
                  {plan}
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-slate-600">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.planPrices[plan]}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (!isNaN(n) && n >= 0) updateDraftPrice(plan, n);
                    }}
                    className="w-28 h-8 px-2.5 text-[13px] font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500/50 [appearance:textfield]"
                  />
                  <span className="text-[11px] text-slate-600">/mo</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trial Duration */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Trial Duration
          </CardTitle>
          <p className="text-[11px] text-slate-600 mt-0.5">Default trial period for new organizations. Applies to new sign-ups only.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <NumberInput
            label="Trial Days"
            value={draft.trialDays}
            min={1}
            max={365}
            suffix="days"
            onChange={(v) => setDraft({ ...draft, trialDays: Math.round(v) })}
          />
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className={cn("border", draft.maintenanceMode ? "bg-red-950/20 border-red-700/30" : "bg-slate-900/60 border-slate-800")}>
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className={cn("text-[13px] font-semibold flex items-center gap-2", draft.maintenanceMode ? "text-red-400" : "text-slate-300")}>
            <ShieldAlert className="w-4 h-4" />
            Maintenance Mode
          </CardTitle>
          <p className="text-[11px] text-slate-600 mt-0.5">When enabled, the platform indicates scheduled maintenance to all users.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-slate-300">
                Status: <span className={cn("font-semibold", draft.maintenanceMode ? "text-red-400" : "text-emerald-400")}>
                  {draft.maintenanceMode ? "MAINTENANCE MODE ON" : "Normal operation"}
                </span>
              </p>
              {draft.maintenanceMode && (
                <p className="text-[11px] text-red-400/70 mt-1">New logins and API access will see a maintenance notice.</p>
              )}
            </div>
            <button
              onClick={() => setDraft({ ...draft, maintenanceMode: !draft.maintenanceMode })}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none",
                draft.maintenanceMode ? "bg-red-500 border-red-500" : "bg-slate-700 border-slate-600"
              )}>
              <span className={cn(
                "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                draft.maintenanceMode ? "translate-x-5" : "translate-x-0.5"
              )} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Announcement Banner */}
      <Card className="bg-slate-900/60 border-slate-800">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-[13px] font-semibold text-slate-300 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-blue-400" />
            Announcement Banner
          </CardTitle>
          <p className="text-[11px] text-slate-600 mt-0.5">Platform-wide message. Leave empty to hide. Shown to platform admins via /api/sadmin/settings.</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-3">
          <textarea
            value={draft.announcement}
            onChange={(e) => setDraft({ ...draft, announcement: e.target.value })}
            placeholder="Enter an announcement message… (max 500 characters)"
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 text-[12px] rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-700">{draft.announcement.length}/500</span>
            {draft.announcement && (
              <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 max-w-sm">
                <p className="text-[11px] font-medium text-blue-400 flex items-center gap-1.5 mb-1">
                  <Megaphone className="w-3 h-3" /> Preview
                </p>
                <p className="text-[12px] text-blue-300">{draft.announcement}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
