"use client";

import { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, Save, Plus, Trash2, ChevronUp, ChevronDown,
  CheckCircle2, X, Zap, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

type PlanFeature = { text: string; included: boolean };
type PlanConfig = {
  key: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice: number;
  memberLimit: number;
  isPopular: boolean;
  ctaText: string;
  features: PlanFeature[];
};

const BASE_COLORS: Array<{ tab: string; badge: string; bar: string }> = [
  { tab: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", bar: "bg-emerald-500" },
  { tab: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",          badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",         bar: "bg-cyan-500"     },
  { tab: "border-violet-500/40 bg-violet-500/10 text-violet-300",    badge: "border-violet-500/30 bg-violet-500/10 text-violet-400",   bar: "bg-violet-500"   },
  { tab: "border-amber-500/40 bg-amber-500/10 text-amber-300",       badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",      bar: "bg-amber-500"    },
  { tab: "border-pink-500/40 bg-pink-500/10 text-pink-300",          badge: "border-pink-500/30 bg-pink-500/10 text-pink-400",         bar: "bg-pink-500"     },
  { tab: "border-teal-500/40 bg-teal-500/10 text-teal-300",          badge: "border-teal-500/30 bg-teal-500/10 text-teal-400",         bar: "bg-teal-500"     },
  { tab: "border-rose-500/40 bg-rose-500/10 text-rose-300",          badge: "border-rose-500/30 bg-rose-500/10 text-rose-400",         bar: "bg-rose-500"     },
  { tab: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",    badge: "border-indigo-500/30 bg-indigo-500/10 text-indigo-400",   bar: "bg-indigo-500"   },
];

function planColors(index: number) {
  return BASE_COLORS[index % BASE_COLORS.length]!;
}

const PLAN_BLANK: Omit<PlanConfig, "key"> = {
  name: "New Plan",
  description: "",
  price: 0,
  yearlyPrice: 0,
  memberLimit: 0,
  isPopular: false,
  ctaText: "Get Started",
  features: [{ text: "", included: true }],
};

const KEY_RE = /^[a-z0-9][a-z0-9-]*$/;

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 20);
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{children}</label>
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, maxLength, className,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={cn(
        "w-full h-8 px-2.5 text-[12px] rounded-lg bg-slate-800 border border-slate-700 text-slate-200",
        "placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50",
        className,
      )}
    />
  );
}

function NumberInput({
  value, onChange, min = 0, prefix, suffix,
}: {
  value: number; onChange: (v: number) => void;
  min?: number; prefix?: string; suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {prefix && <span className="text-[12px] text-slate-600 shrink-0">{prefix}</span>}
      <input
        type="number"
        min={min}
        step="1"
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n) && n >= min) onChange(n);
        }}
        className="w-24 h-8 px-2.5 text-[13px] font-semibold rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-cyan-500/50 [appearance:textfield]"
      />
      {suffix && <span className="text-[12px] text-slate-600 shrink-0">{suffix}</span>}
    </div>
  );
}

/* ─── Plan editor ─────────────────────────────────────────────────────────── */

function PlanEditor({
  plan, isNew, onUpdate, onTogglePopular,
}: {
  plan: PlanConfig;
  isNew: boolean;
  onUpdate: (patch: Partial<PlanConfig>) => void;
  onTogglePopular: () => void;
}) {
  function updateFeatureText(i: number, text: string) {
    const f = [...plan.features];
    f[i] = { ...f[i]!, text };
    onUpdate({ features: f });
  }

  function toggleFeatureIncluded(i: number) {
    const f = [...plan.features];
    f[i] = { ...f[i]!, included: !f[i]!.included };
    onUpdate({ features: f });
  }

  function removeFeature(i: number) {
    onUpdate({ features: plan.features.filter((_, idx) => idx !== i) });
  }

  function moveFeature(i: number, dir: -1 | 1) {
    const f = [...plan.features];
    const j = i + dir;
    if (j < 0 || j >= f.length) return;
    [f[i], f[j]] = [f[j]!, f[i]!];
    onUpdate({ features: f });
  }

  function addFeature() {
    onUpdate({ features: [...plan.features, { text: "", included: true }] });
  }

  const keyInvalid = isNew && plan.key.length > 0 && !KEY_RE.test(plan.key);

  return (
    <div className="space-y-5">
      {/* Identity */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Identity</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Plan Name</FieldLabel>
            <TextInput value={plan.name} onChange={(v) => onUpdate({ name: v })} placeholder="e.g. Starter" maxLength={40} />
          </div>

          <div>
            {isNew ? (
              <>
                <FieldLabel hint="Lowercase letters, numbers and hyphens only">Plan Key</FieldLabel>
                <div className="relative">
                  <TextInput
                    value={plan.key}
                    onChange={(v) => onUpdate({ key: slugify(v) })}
                    placeholder="e.g. business"
                    maxLength={20}
                    className={cn(keyInvalid && "border-red-500/60 focus:border-red-500")}
                  />
                  {keyInvalid && (
                    <p className="text-[10px] text-red-400 mt-0.5">Only lowercase letters, numbers, and hyphens (must start with a letter or digit)</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <FieldLabel hint="Internal identifier — cannot be changed after save">Plan Key</FieldLabel>
                <div className="h-8 px-2.5 flex items-center rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <span className="text-[12px] font-mono text-slate-600">{plan.key}</span>
                </div>
              </>
            )}
          </div>

          <div className="sm:col-span-2">
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={plan.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="A short tagline for this plan"
              maxLength={200}
              rows={2}
              className="w-full px-2.5 py-1.5 text-[12px] rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Limits */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pricing & Limits</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <FieldLabel hint="Price per user">Monthly Price</FieldLabel>
            <NumberInput value={plan.price} onChange={(v) => onUpdate({ price: v })} prefix="$" suffix="/user/mo" />
          </div>
          <div>
            <FieldLabel hint="Price per user, shown as 'billed yearly'">Yearly Price /mo</FieldLabel>
            <NumberInput value={plan.yearlyPrice} onChange={(v) => onUpdate({ yearlyPrice: v })} prefix="$" suffix="/user/mo" />
          </div>
          <div>
            <FieldLabel hint="0 = unlimited seats">Max Users</FieldLabel>
            <NumberInput value={plan.memberLimit} onChange={(v) => onUpdate({ memberLimit: Math.round(v) })} suffix={plan.memberLimit === 0 ? "∞" : "users"} />
          </div>
        </CardContent>
      </Card>

      {/* Display */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Display</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel>CTA Button Text</FieldLabel>
            <TextInput value={plan.ctaText} onChange={(v) => onUpdate({ ctaText: v })} placeholder="Get Started" maxLength={30} />
          </div>
          <div>
            <FieldLabel hint="Only one plan should be 'Most Popular'">Most Popular Badge</FieldLabel>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={onTogglePopular}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none",
                  plan.isPopular ? "bg-amber-500 border-amber-500" : "bg-slate-700 border-slate-600",
                )}>
                <span className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  plan.isPopular ? "translate-x-5" : "translate-x-0.5",
                )} />
              </button>
              {plan.isPopular && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                  <Zap className="w-3 h-3" /> Most Popular
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Features <span className="text-slate-700 font-normal normal-case">({plan.features.length})</span>
          </CardTitle>
          <button
            onClick={addFeature}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors">
            <Plus className="w-3 h-3" /> Add Feature
          </button>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {plan.features.length === 0 && (
            <p className="text-[12px] text-slate-600 text-center py-4">No features yet. Add one above.</p>
          )}
          {plan.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleFeatureIncluded(i)}
                title={feature.included ? "Included — click to exclude" : "Excluded — click to include"}
                className="shrink-0">
                {feature.included
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 hover:text-emerald-300 transition-colors" />
                  : <X className="w-4 h-4 text-slate-600 hover:text-slate-400 transition-colors" />
                }
              </button>
              <input
                type="text"
                value={feature.text}
                onChange={(e) => updateFeatureText(i, e.target.value)}
                placeholder="Feature description"
                maxLength={150}
                className={cn(
                  "flex-1 h-7 px-2 text-[12px] rounded-md bg-slate-800/70 border border-slate-700/60 focus:outline-none focus:border-cyan-500/40",
                  feature.included ? "text-slate-200" : "text-slate-500",
                )}
              />
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => moveFeature(i, -1)} disabled={i === 0}
                  className="p-1 rounded text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moveFeature(i, 1)} disabled={i === plan.features.length - 1}
                  className="p-1 rounded text-slate-600 hover:text-slate-300 disabled:opacity-20 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeFeature(i)}
                  className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors ml-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function PlanConfigPage() {
  const [configs, setConfigs]     = useState<PlanConfig[]>([]);
  const [original, setOriginal]   = useState<PlanConfig[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ planConfigs: PlanConfig[] }>("/api/sadmin/plans/config");
      setConfigs(res.planConfigs);
      setOriginal(res.planConfigs);
    } catch { toast.error("Failed to load plan configuration"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function updatePlan(index: number, patch: Partial<PlanConfig>) {
    setConfigs((prev) => prev.map((p, i) => i === index ? { ...p, ...patch } : p));
  }

  function togglePopular(index: number) {
    setConfigs((prev) => prev.map((p, i) => ({ ...p, isPopular: i === index ? !p.isPopular : false })));
  }

  function addPlan() {
    const suffix = configs.length + 1;
    const newPlan: PlanConfig = {
      ...PLAN_BLANK,
      key: `plan-${suffix}`,
      name: `Plan ${suffix}`,
    };
    setConfigs((prev) => [...prev, newPlan]);
    setActiveTab(configs.length); // index after push
  }

  function confirmDelete(index: number) {
    const plan = configs[index]!;
    const isNew = !original.some((o) => o.key === plan.key);
    if (isNew) {
      deletePlan(index);
    } else {
      setDeleteTarget(index);
    }
  }

  function deletePlan(index: number) {
    setDeleteTarget(null);
    const newConfigs = configs.filter((_, i) => i !== index);
    setConfigs(newConfigs);
    setActiveTab((prev) => Math.min(prev, Math.max(0, newConfigs.length - 1)));
  }

  async function handleSave() {
    // Validate all plans
    const keys = new Set<string>();
    for (const plan of configs) {
      if (!plan.key.trim()) {
        toast.error(`One of the plans has an empty key — fill it in`);
        return;
      }
      if (!KEY_RE.test(plan.key)) {
        toast.error(`Plan key "${plan.key}" is invalid — use lowercase letters, numbers, and hyphens only`);
        return;
      }
      if (keys.has(plan.key)) {
        toast.error(`Duplicate plan key: "${plan.key}" — each plan must have a unique key`);
        return;
      }
      keys.add(plan.key);
      if (!plan.name.trim()) {
        toast.error(`A plan is missing a name — fill it in`);
        return;
      }
      if (!plan.description.trim()) {
        toast.error(`"${plan.name}" is missing a description`);
        return;
      }
      if (!plan.ctaText.trim()) {
        toast.error(`"${plan.name}" is missing a CTA button text`);
        return;
      }
      if (plan.features.length === 0) {
        toast.error(`"${plan.name}" needs at least one feature`);
        return;
      }
      if (plan.features.some((f) => !f.text.trim())) {
        toast.error(`"${plan.name}" has an empty feature — fill it in or remove it`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await apiPatch<{ planConfigs: PlanConfig[] }>("/api/sadmin/plans/config", { planConfigs: configs });
      setConfigs(res.planConfigs);
      setOriginal(res.planConfigs);
      toast.success("Plan configuration saved — pricing page and billing are now live");
    } catch { toast.error("Failed to save plan configuration"); }
    finally { setSaving(false); }
  }

  function handleReset() {
    setConfigs(JSON.parse(JSON.stringify(original)) as PlanConfig[]);
    setActiveTab((prev) => Math.min(prev, original.length - 1));
    toast("Reset to last saved values");
  }

  const isDirty = JSON.stringify(configs) !== JSON.stringify(original);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-10 bg-slate-800 animate-pulse rounded-xl" />
        <div className="h-64 bg-slate-800 animate-pulse rounded-xl" />
      </div>
    );
  }

  const activePlan = configs[activeTab];
  const isNewPlan  = activePlan ? !original.some((o) => o.key === activePlan.key) : false;

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Plan Configuration</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Changes publish instantly to <span className="font-mono text-slate-400">/pricing</span> and the billing page.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isDirty && (
            <button onClick={handleReset}
              className="h-8 px-3 text-[12px] border border-slate-700 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
              Reset
            </button>
          )}
          <Button onClick={() => void handleSave()} disabled={saving || !isDirty} size="sm"
            className={cn(
              "h-8 text-[12px] transition-all",
              isDirty ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-slate-800 text-slate-500 opacity-60 cursor-not-allowed",
            )}>
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving…" : "Save & Publish"}
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
          <span className="text-[12px] text-amber-400 font-medium">Unsaved changes — save to publish to /pricing and dashboard billing</span>
        </div>
      )}

      {/* Plan tabs + Add Plan */}
      <div className="flex items-center gap-2 flex-wrap">
        {configs.map((plan, i) => {
          const colors  = planColors(i);
          const isActive = i === activeTab;
          const isDirtyTab = JSON.stringify(plan) !== JSON.stringify(original[i]);
          return (
            <button
              key={`${plan.key}-${i}`}
              onClick={() => setActiveTab(i)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold border transition-all",
                isActive
                  ? colors.tab
                  : "border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700 bg-slate-900/40",
              )}>
              {plan.name || <span className="text-slate-600 italic">Unnamed</span>}
              {plan.isPopular && <Zap className="w-3 h-3 text-amber-400" />}
              {isDirtyTab && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
            </button>
          );
        })}

        {/* Add Plan button */}
        {configs.length < 10 && (
          <button
            onClick={addPlan}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold border border-dashed border-slate-700 text-slate-500 hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/5 transition-all">
            <Plus className="w-3.5 h-3.5" /> Add Plan
          </button>
        )}
      </div>

      {/* Active plan editor */}
      {activePlan && (
        <>
          {/* Plan header row: key badge + delete */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px]", planColors(activeTab).badge)}>
                {activePlan.key || "no key"}
              </Badge>
              {isNewPlan && (
                <span className="text-[10px] font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
                  New — not yet saved
                </span>
              )}
            </div>
            <button
              onClick={() => confirmDelete(activeTab)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-red-400/70 border border-red-500/20 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
              Delete Plan
            </button>
          </div>

          <PlanEditor
            plan={activePlan}
            isNew={isNewPlan}
            onUpdate={(patch) => updatePlan(activeTab, patch)}
            onTogglePopular={() => togglePopular(activeTab)}
          />
        </>
      )}

      {configs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm mb-3">No plans configured. Add one to get started.</p>
          <button
            onClick={addPlan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 text-[13px] font-medium transition-colors">
            <Plus className="w-4 h-4" /> Add Your First Plan
          </button>
        </div>
      )}

      {/* Live preview strip */}
      {activePlan && (
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Pricing Card Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              {/* Mini card */}
              <div className="w-56 shrink-0 rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-white">{activePlan.name || "—"}</span>
                  {activePlan.isPopular && (
                    <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                      Most Popular
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{activePlan.description || "No description"}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-white">${activePlan.price}</span>
                  <span className="text-[11px] text-slate-500">/user/mo</span>
                </div>
                {activePlan.yearlyPrice > 0 && (
                  <p className="text-[10px] text-slate-600">
                    ${activePlan.yearlyPrice}/user/mo yearly (save ${activePlan.price - activePlan.yearlyPrice}/user)
                  </p>
                )}
                <ul className="space-y-1.5">
                  {activePlan.features.slice(0, 5).map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-[11px]">
                      {f.included
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        : <X className="w-3 h-3 text-slate-600 shrink-0" />
                      }
                      <span className={f.included ? "text-slate-300" : "text-slate-600"}>
                        {f.text || <em className="text-slate-700">empty</em>}
                      </span>
                    </li>
                  ))}
                  {activePlan.features.length > 5 && (
                    <li className="text-[10px] text-slate-700">+{activePlan.features.length - 5} more</li>
                  )}
                </ul>
                <div className="pt-1">
                  <div className="w-full h-8 rounded-lg bg-slate-700/60 flex items-center justify-center text-[12px] font-semibold text-slate-400">
                    {activePlan.ctaText || "Get Started"}
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3 text-[12px]">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-[10px] capitalize", planColors(activeTab).badge)}>
                    {activePlan.key || "no key"}
                  </Badge>
                  {isNewPlan
                    ? <span className="text-cyan-400 text-[10px]">new plan — set a unique key before saving</span>
                    : <span className="text-slate-500 text-[10px]">key cannot be changed after save</span>
                  }
                </div>
                <div className="space-y-1 text-slate-400">
                  <p>Monthly: <span className="font-semibold text-white">${activePlan.price}/user/mo</span></p>
                  {activePlan.yearlyPrice > 0 && (
                    <p>Yearly: <span className="font-semibold text-white">${activePlan.yearlyPrice}/user/mo</span>
                      {activePlan.price > 0 && (
                        <span className="text-emerald-400 ml-1">
                          ({Math.round((1 - activePlan.yearlyPrice / activePlan.price) * 100)}% off)
                        </span>
                      )}
                    </p>
                  )}
                  <p>Max users: <span className="font-semibold text-white">
                    {activePlan.memberLimit === 0 ? "Unlimited" : activePlan.memberLimit}
                  </span></p>
                  <p>Features: <span className="font-semibold text-white">{activePlan.features.length} total</span>
                    {" "}(<span className="text-emerald-400">{activePlan.features.filter((f) => f.included).length} included</span>)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-4 h-4" />
              Delete "{deleteTarget !== null ? (configs[deleteTarget]?.name ?? "") : ""}"?
            </DialogTitle>
            <DialogDescription>
              This plan will be removed from the pricing page and billing once you save.
              Existing subscribers on this plan will NOT be automatically migrated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => deleteTarget !== null && deletePlan(deleteTarget)}>
              Delete Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
