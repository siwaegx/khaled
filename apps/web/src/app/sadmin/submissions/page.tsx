"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, CheckCircle, XCircle, Clock, ExternalLink, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiGet, apiPatch } from "@/lib/api";
import { toast } from "sonner";

type Submission = {
  id: string; key: string; name: string; version: string;
  category: string; description: string; repoUrl: string;
  contactEmail: string; status: string; reviewNote: string | null;
  submittedAt: string; reviewedAt: string | null;
  developer: { user: { id: string; name: string; email: string } };
};

const STATUS_STYLE: Record<string, string> = {
  pending:  "border-amber-500/30 bg-amber-500/10 text-amber-400",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  rejected: "border-red-500/30 bg-red-500/10 text-red-400",
};

type FilterTab = "all" | "pending" | "approved" | "rejected";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter]           = useState<FilterTab>("pending");
  const [loading, setLoading]         = useState(true);
  const [reviewing, setReviewing]     = useState<string | null>(null);
  const [notes, setNotes]             = useState<Record<string, string>>({});
  const [counts, setCounts]           = useState({ pending: 0, approved: 0, rejected: 0 });

  const load = useCallback(async (f = filter) => {
    setLoading(true);
    try {
      const res = await apiGet<{ submissions: Submission[]; pendingCount: number }>(`/api/sadmin/submissions?status=${f}`);
      setSubmissions(res.submissions);
      if (f === "pending")  setCounts((c) => ({ ...c, pending:  res.submissions.length }));
      if (f === "approved") setCounts((c) => ({ ...c, approved: res.submissions.length }));
      if (f === "rejected") setCounts((c) => ({ ...c, rejected: res.submissions.length }));
      // Always update pending badge from API
      setCounts((c) => ({ ...c, pending: res.pendingCount }));
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  function handleFilterChange(f: FilterTab) {
    setFilter(f);
    void load(f);
  }

  async function review(id: string, status: "approved" | "rejected") {
    const note = notes[id]?.trim();
    if (status === "rejected" && !note) {
      toast.error("Please provide a rejection note");
      return;
    }
    setReviewing(id);
    try {
      await apiPatch(`/api/sadmin/submissions/${id}`, { status, ...(note ? { reviewNote: note } : {}) });
      toast.success(status === "approved" ? "Submission approved — module is now live" : "Submission rejected");
      setNotes((prev) => { const n = { ...prev }; delete n[id]; return n; });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally { setReviewing(null); }
  }

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: "pending",  label: "Pending",  count: counts.pending },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "all",      label: "All" },
  ];

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Module Submissions</h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Review third-party module submissions from the developer community
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}
          className="h-8 text-[12px] border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-slate-800 pb-0">
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => handleFilterChange(key)}
            className={cn(
              "px-4 py-2 text-[12px] font-medium transition-all border-b-2 -mb-px",
              filter === key
                ? "text-cyan-400 border-cyan-400"
                : "text-slate-500 border-transparent hover:text-slate-300"
            )}>
            {label}
            {count !== undefined && count > 0 && (
              <span className={cn("ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                filter === key ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-500")}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : submissions.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-800">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Package className="w-10 h-10 text-slate-700" />
            <p className="text-[13px] text-slate-600">No {filter !== "all" ? filter : ""} submissions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <Card key={sub.id} className={cn(
              "bg-slate-900/60 border-slate-800 transition-colors",
              sub.status === "pending" && "border-amber-500/15"
            )}>
              <CardContent className="p-5">
                <div className="flex gap-5">
                  {/* Left: module info */}
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-[14px] font-semibold text-slate-100">{sub.name}</h3>
                          <span className="text-[11px] font-mono text-slate-600">{sub.key}</span>
                          <span className="text-[11px] text-slate-600">v{sub.version}</span>
                          <Badge variant="outline" className="text-[10px] capitalize border-slate-700 bg-slate-800 text-slate-400">
                            {sub.category}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[11px] capitalize gap-1", STATUS_STYLE[sub.status] ?? "")}>
                            {sub.status === "pending"  && <Clock className="w-2.5 h-2.5" />}
                            {sub.status === "approved" && <CheckCircle className="w-2.5 h-2.5" />}
                            {sub.status === "rejected" && <XCircle className="w-2.5 h-2.5" />}
                            {sub.status}
                          </Badge>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{sub.description}</p>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
                      <span>By <span className="text-slate-400">{sub.developer.user.name}</span></span>
                      <span className="font-mono text-slate-600">{sub.developer.user.email}</span>
                      <span>Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
                      {sub.reviewedAt && <span>Reviewed {new Date(sub.reviewedAt).toLocaleDateString()}</span>}
                      {sub.repoUrl && (
                        <a href={sub.repoUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-cyan-500 hover:text-cyan-400 hover:underline transition-colors">
                          <ExternalLink className="w-3 h-3" />
                          Repository
                        </a>
                      )}
                    </div>

                    {/* Existing review note */}
                    {sub.reviewNote && (
                      <div className={cn("px-3 py-2 rounded-lg text-[12px] border",
                        sub.status === "approved"
                          ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-300"
                          : "bg-red-500/5 border-red-500/15 text-red-300")}>
                        <span className="font-medium opacity-70">Review note: </span>{sub.reviewNote}
                      </div>
                    )}
                  </div>

                  {/* Right: review actions (pending only) */}
                  {sub.status === "pending" && (
                    <div className="w-60 shrink-0 flex flex-col gap-2.5">
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                        Review Note
                      </label>
                      <textarea
                        placeholder="Add a note for the developer (required for rejection)…"
                        value={notes[sub.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                        rows={4}
                        className="w-full px-3 py-2 text-[12px] rounded-lg bg-slate-800 border border-slate-700 text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 resize-none leading-relaxed"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void review(sub.id, "approved")}
                          disabled={reviewing === sub.id}
                          className="flex-1 h-8 text-[12px] font-medium rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => void review(sub.id, "rejected")}
                          disabled={reviewing === sub.id}
                          className="flex-1 h-8 text-[12px] font-medium rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600">Rejection note is required</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
