"use client";

import { useState } from "react";
import { ArrowLeft, Code2, CheckCircle2, Loader2, BookOpen, DollarSign, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { apiPost } from "@/lib/api";

const STEPS = [
  { icon: Code2,       title: "Build your module",   desc: "Use our Module SDK and manifest format to build your app on top of the Business360 engine." },
  { icon: BookOpen,    title: "Submit for review",    desc: "Fill in the form below. Our team reviews submissions within 3–5 business days." },
  { icon: Globe,       title: "Publish to the store", desc: "Once approved, your module appears in the store for all Business360 customers." },
  { icon: DollarSign,  title: "Earn revenue",         desc: "Set your price. We handle payments and pay out 70% of revenue to you monthly." },
];

const CATEGORIES = [
  { value: "core",        label: "Core Module" },
  { value: "integration", label: "Integration" },
  { value: "industry",    label: "Industry Pack" },
  { value: "community",   label: "Community" },
  { value: "premium",     label: "Premium" },
];

interface FormState {
  name: string;
  description: string;
  category: string;
  repoUrl: string;
  contactEmail: string;
}

const EMPTY: FormState = { name: "", description: "", category: "community", repoUrl: "", contactEmail: "" };

export default function DeveloperPortalPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ referenceId: string } | null>(null);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiPost<{ submission: { referenceId: string } }>("/api/store/submit", form);
      setSubmitted(result.submission);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link href="/dashboard/store" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Store
      </Link>

      {/* Hero */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Code2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">Developer Portal</h1>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">Beta</Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Build and publish modules for the Business360 ecosystem. Reach thousands of businesses
              and earn revenue from your work.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="space-y-3">
        <h2 className="font-semibold text-base">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission form or success */}
      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h2 className="font-bold text-lg text-emerald-800">Submission received!</h2>
          <p className="text-sm text-emerald-700 max-w-sm mx-auto">
            Our team will review your module within 3–5 business days and reach out via email.
          </p>
          <p className="text-xs text-emerald-600 font-mono">Ref: {submitted.referenceId}</p>
          <Button variant="outline" className="mt-2" onClick={() => setSubmitted(null)}>
            Submit another module
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-6">
          <h2 className="font-semibold text-base">Submit your module</h2>
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Module name</label>
                <input className={inputClass} placeholder="e.g. My Awesome Module" value={form.name} onChange={set("name")} required minLength={2} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <select className={inputClass} value={form.category} onChange={set("category")} required>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Short description</label>
              <textarea className={`${inputClass} resize-none`} rows={3} placeholder="Describe what your module does in 1–2 sentences..." value={form.description} onChange={set("description")} required minLength={10} maxLength={300} />
              <p className="text-xs text-muted-foreground text-right">{form.description.length}/300</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Repository URL</label>
                <input className={inputClass} type="url" placeholder="https://github.com/you/module" value={form.repoUrl} onChange={set("repoUrl")} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact email</label>
                <input className={inputClass} type="email" placeholder="you@example.com" value={form.contactEmail} onChange={set("contactEmail")} required />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit for review
            </Button>
          </form>
        </div>
      )}

      {/* Revenue info */}
      <div className="rounded-xl border bg-muted/30 p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <DollarSign className="w-8 h-8 text-emerald-500 shrink-0" />
        <div>
          <p className="font-semibold text-sm">Earn 70% revenue share</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set your own pricing. Business360 handles payments, subscriptions, and customer support — you keep 70% of every sale, paid monthly.
          </p>
        </div>
      </div>
    </div>
  );
}
