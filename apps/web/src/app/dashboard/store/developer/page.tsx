"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, Code2, CheckCircle2, Loader2, BookOpen, DollarSign,
  Globe, Send, Clock, XCircle, User, ExternalLink, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { apiGet, apiPost } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = [
  { icon: Code2,      title: "Build your module",    desc: "Follow MODULE_RULES.txt — manifest, frontend, backend, Prisma schema, tests." },
  { icon: User,       title: "Join the program",     desc: "Create a free developer account below. One account, unlimited submissions." },
  { icon: Send,       title: "Submit for review",    desc: "Fill in the submission form. Our team reviews within 3–5 business days." },
  { icon: Globe,      title: "Publish & earn",        desc: "Once approved, your module appears in the store. Keep 70% of every sale." },
];

const CATEGORIES = [
  { value: "core",        label: "Core Module" },
  { value: "integration", label: "Integration" },
  { value: "industry",    label: "Industry Pack" },
  { value: "community",   label: "Community" },
  { value: "premium",     label: "Premium" },
];

const STATUS_STYLE: Record<string, string> = {
  pending:  "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

type Submission = {
  id: string;
  name: string;
  key: string;
  version: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  submittedAt: string;
  repoUrl: string;
  module: { id: string } | null;
};

type DeveloperProfile = {
  id: string;
  displayName: string;
  website: string | null;
  bio: string | null;
  createdAt: string;
  submissions: Submission[];
};

type JoinForm  = { displayName: string; website: string; bio: string };
type SubmitForm = { name: string; key: string; version: string; category: string; description: string; repoUrl: string; contactEmail: string };

const EMPTY_JOIN: JoinForm   = { displayName: "", website: "", bio: "" };
const EMPTY_SUB: SubmitForm  = { name: "", key: "", version: "1.0.0", category: "community", description: "", repoUrl: "", contactEmail: "" };

const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function DeveloperPortalPage() {
  const [profile, setProfile]       = useState<DeveloperProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [joinForm, setJoinForm]     = useState<JoinForm>(EMPTY_JOIN);
  const [joinBusy, setJoinBusy]     = useState(false);
  const [subForm, setSubForm]       = useState<SubmitForm>(EMPTY_SUB);
  const [subBusy, setSubBusy]       = useState(false);
  const [subDone, setSubDone]       = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiGet<{ profile: DeveloperProfile }>("/api/developer/profile");
      setProfile(res.profile);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  function setJoin(f: keyof JoinForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setJoinForm((p) => ({ ...p, [f]: e.target.value }));
  }
  function setSub(f: keyof SubmitForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setSubForm((p) => ({ ...p, [f]: e.target.value }));
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinBusy(true);
    try {
      await apiPost("/api/developer/profile", joinForm);
      toast.success("Developer account created!");
      await loadProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setJoinBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubBusy(true);
    try {
      await apiPost("/api/developer/submissions", subForm);
      toast.success("Module submitted for review!");
      setSubForm(EMPTY_SUB);
      setSubDone(true);
      await loadProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>
    );
  }

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
              Build and publish modules for the Business360 ecosystem. Reach thousands of businesses and earn revenue from your work.
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

      {profile ? (
        /* ── DEVELOPER DASHBOARD ── */
        <>
          {/* Profile header */}
          <div className="rounded-xl border bg-card p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{profile.displayName}</p>
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
                  <Globe className="w-3 h-3" /> {profile.website}
                </a>
              )}
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-xs shrink-0">
              Developer
            </Badge>
          </div>

          {/* Submit form */}
          <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Submit a new module</h2>
              {subDone && (
                <button onClick={() => setSubDone(false)} className="text-xs text-primary hover:underline">
                  Submit another
                </button>
              )}
            </div>

            {subDone ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="font-semibold text-emerald-800 text-sm">Submission received!</p>
                <p className="text-xs text-emerald-700">We&apos;ll review it within 3–5 business days. Track the status in the table below.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Module name</label>
                    <input className={inputClass} placeholder="e.g. AI Sales Assistant" value={subForm.name} onChange={setSub("name")} required minLength={2} maxLength={80} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Module key</label>
                    <input className={inputClass} placeholder="e.g. ai-sales-assistant" value={subForm.key} onChange={setSub("key")} required minLength={2} maxLength={40} pattern="[a-z0-9-]+" title="Lowercase letters, numbers, and hyphens only" />
                    <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens. Unique identifier.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Version</label>
                    <input className={inputClass} placeholder="1.0.0" value={subForm.version} onChange={setSub("version")} required pattern="\d+\.\d+\.\d+" title="Format: MAJOR.MINOR.PATCH" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Category</label>
                    <select className={inputClass} value={subForm.category} onChange={setSub("category")} required>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Description</label>
                  <textarea className={cn(inputClass, "resize-none")} rows={3} placeholder="Describe what your module does in 2–3 sentences..." value={subForm.description} onChange={setSub("description")} required minLength={10} maxLength={1000} />
                  <p className="text-xs text-muted-foreground text-right">{subForm.description.length}/1000</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Repository URL</label>
                    <input className={inputClass} type="url" placeholder="https://github.com/you/module" value={subForm.repoUrl} onChange={setSub("repoUrl")} required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Contact email</label>
                    <input className={inputClass} type="email" placeholder="you@example.com" value={subForm.contactEmail} onChange={setSub("contactEmail")} required />
                  </div>
                </div>
                <Button type="submit" disabled={subBusy}>
                  {subBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit for review
                </Button>
              </form>
            )}
          </div>

          {/* Submissions table */}
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-sm">My submissions</h2>
              <button onClick={() => void loadProfile()} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {profile.submissions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No submissions yet. Submit your first module above.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Module</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Version</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Submitted</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Repo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {profile.submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{sub.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{sub.key}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{sub.version}</td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <Badge variant="outline" className={cn("text-xs capitalize", STATUS_STYLE[sub.status] ?? "")}>
                              {sub.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                              {sub.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                              {sub.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                              {sub.status}
                            </Badge>
                            {sub.reviewNote && (
                              <p className="text-xs text-muted-foreground italic max-w-xs">{sub.reviewNote}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <a href={sub.repoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── JOIN FORM ── */
        <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-semibold text-base mb-1">Join the Developer Program</h2>
            <p className="text-sm text-muted-foreground">Create your developer profile to start submitting modules to the Business360 marketplace.</p>
          </div>
          <form onSubmit={handleJoin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display name <span className="text-destructive">*</span></label>
              <input className={inputClass} placeholder="e.g. Acme Plugins" value={joinForm.displayName} onChange={setJoin("displayName")} required minLength={2} maxLength={80} />
              <p className="text-xs text-muted-foreground">Shown on all your modules in the store.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Website <span className="text-muted-foreground text-xs">(optional)</span></label>
              <input className={inputClass} type="url" placeholder="https://yourwebsite.com" value={joinForm.website} onChange={setJoin("website")} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bio <span className="text-muted-foreground text-xs">(optional)</span></label>
              <textarea className={cn(inputClass, "resize-none")} rows={2} placeholder="Tell us about yourself or your company..." value={joinForm.bio} onChange={setJoin("bio")} maxLength={500} />
            </div>
            <Button type="submit" disabled={joinBusy}>
              {joinBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <User className="w-4 h-4 mr-2" />}
              Create developer account
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
            Set your own pricing. Business360 handles payments and subscriptions — you keep 70% of every sale, paid monthly.
          </p>
        </div>
      </div>
    </div>
  );
}
