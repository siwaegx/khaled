"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw, Bot, MessageSquare, Search, Zap, AlertTriangle,
  Clock, Coins, ChevronLeft, ChevronRight, Trash2, Settings,
  ClipboardList, Activity, ToggleLeft, ToggleRight, Save,
  CheckCircle2, Circle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// ── Types ────────────────────────────────────────────────────────────────────

interface AILogEntry {
  id: string; timestamp: string;
  type: "chat" | "analyze" | "task_suggest";
  prompt: string; model: string;
  inputTokens: number; outputTokens: number;
  cacheReadTokens: number; cacheCreationTokens: number;
  durationMs: number; status: "success" | "error"; error?: string;
}
interface LogStats {
  total: number; errors: number;
  totalInputTokens: number; totalOutputTokens: number;
  totalCacheReadTokens: number; avgDurationMs: number;
  byType: { chat: number; analyze: number; task_suggest: number };
}
interface LogResponse {
  entries: AILogEntry[]; total: number; page: number; limit: number;
  pages: number; stats: LogStats;
}
interface AIConfig {
  model: string;
  features: { chat: boolean; analyze: boolean; taskSuggest: boolean };
  maxLogEntries: number; chatMaxTokens: number;
  analyzeMaxTokens: number; analyzeMaxIterations: number;
}
interface ERPAITask {
  id: string; title: string; description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high"; category: string;
  createdAt: string; updatedAt: string;
}
interface TasksResponse {
  tasks: ERPAITask[];
  stats: { total: number; todo: number; in_progress: number; done: number; high: number };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META = {
  chat:         { label: "Chat",    icon: MessageSquare, color: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20" },
  analyze:      { label: "Analyze", icon: Search,        color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  task_suggest: { label: "Tasks",   icon: Zap,           color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
};
const STATUS_CYCLE: Record<ERPAITask["status"], ERPAITask["status"]> = {
  todo: "in_progress", in_progress: "done", done: "todo",
};
const STATUS_COLOR: Record<ERPAITask["status"], string> = {
  todo: "text-slate-500", in_progress: "text-amber-400", done: "text-green-400",
};
const PRIORITY_COLOR: Record<ERPAITask["priority"], string> = {
  low: "text-slate-500 bg-slate-800 border-slate-700",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

function fmtDur(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }
function fmtTok(n: number)  { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function apiFetch(url: string, opts?: RequestInit) {
  return fetch(`${BASE}${url}`, { credentials: "include", ...opts });
}

// ── Main Page ────────────────────────────────────────────────────────────────

type Tab = "log" | "tasks" | "settings";

export default function AIManagePage() {
  const [tab, setTab] = useState<Tab>("log");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">ERPAI Management</h1>
          <p className="text-xs text-slate-500">Monitor activity, manage tasks, and configure the AI agent.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-800 pb-0">
        {([
          { key: "log",      label: "Activity Log", icon: Activity },
          { key: "tasks",    label: "Tasks",        icon: ClipboardList },
          { key: "settings", label: "Settings",     icon: Settings },
        ] as { key: Tab; label: string; icon: React.ElementType }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-all -mb-px",
              tab === key
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "log"      && <LogTab />}
      {tab === "tasks"    && <TasksTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

// ── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab() {
  const [data, setData]               = useState<LogResponse | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [clearing, setClearing]       = useState(false);
  const [page, setPage]               = useState(1);
  const [typeFilter, setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async (p = page, t = typeFilter, s = statusFilter) => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p), limit: "25", type: t, status: s });
      const res = await apiFetch(`/api/sadmin/ai-log?${qs}`);
      if (res.ok) setData(await res.json() as LogResponse);
      else setError(`API error ${res.status}${res.status === 401 ? " — refresh the page to re-authenticate" : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally { setLoading(false); }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function clearLog() {
    if (!confirm("Clear all AI log entries? This cannot be undone.")) return;
    setClearing(true);
    await apiFetch("/api/sadmin/ai-log", { method: "DELETE" });
    setClearing(false);
    setPage(1);
    void load(1, typeFilter, statusFilter);
  }

  function filter(t: string, s: string) {
    setTypeFilter(t); setStatusFilter(s); setPage(1);
    void load(1, t, s);
  }

  const stats = data?.stats;

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Requests", value: stats.total,                      icon: Bot,           color: "text-cyan-400" },
            { label: "Errors",         value: stats.errors,                     icon: AlertTriangle, color: stats.errors > 0 ? "text-red-400" : "text-slate-500" },
            { label: "Avg Duration",   value: fmtDur(stats.avgDurationMs),      icon: Clock,         color: "text-violet-400" },
            { label: "Total Tokens",   value: fmtTok(stats.totalInputTokens + stats.totalOutputTokens), icon: Coins, color: "text-amber-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", color)} />
                <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">{label}</span>
              </div>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "chat", "analyze", "task_suggest"] as const).map((t) => {
          const meta = t !== "all" ? TYPE_META[t] : null;
          const count = stats ? (t === "all" ? stats.total : stats.byType[t]) : "";
          return (
            <button key={t} onClick={() => filter(t, statusFilter)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all",
                typeFilter === t
                  ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                  : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200"
              )}>
              {meta && <meta.icon className={cn("w-3.5 h-3.5", meta.color)} />}
              {t === "all" ? "All" : meta!.label}
              {count !== "" && <span className="text-slate-600">({count})</span>}
            </button>
          );
        })}
        <div className="flex-1" />
        {(["all", "success", "error"] as const).map((s) => (
          <button key={s} onClick={() => filter(typeFilter, s)}
            className={cn("px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all capitalize",
              statusFilter === s
                ? s === "error" ? "bg-red-500/15 border-red-500/30 text-red-300"
                  : s === "success" ? "bg-green-500/15 border-green-500/30 text-green-300"
                  : "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200"
            )}>
            {s === "all" ? "All statuses" : s}
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={() => void load()}
          disabled={loading}
          className="border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 ml-1">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => void clearLog()}
          disabled={clearing || !stats?.total}
          className="border-red-900/50 text-red-500 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Clear log
        </Button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[130px_85px_1fr_100px_90px_75px] gap-3 px-4 py-2.5 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-600">
          <span>Time</span><span>Type</span><span>Prompt</span>
          <span>Tokens</span><span>Duration</span><span>Status</span>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center py-14 text-slate-600 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500/60" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => void load()} className="text-[12px] text-slate-500 hover:text-slate-300 underline">Retry</button>
          </div>
        )}
        {!error && data?.entries.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-slate-600">
            <Bot className="w-8 h-8 opacity-30" />
            <p className="text-sm">No log entries yet.</p>
            <p className="text-xs text-slate-700">Activity appears here after ERPAI handles its first request.</p>
          </div>
        )}

        {data?.entries.map((entry, i) => {
          const meta = TYPE_META[entry.type];
          const totalTok = (entry.inputTokens ?? 0) + (entry.outputTokens ?? 0);
          return (
            <div key={entry.id}
              className={cn("grid grid-cols-[130px_85px_1fr_100px_90px_75px] gap-3 px-4 py-3 text-[12px] border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors",
                i % 2 === 1 && "bg-slate-900/20")}>
              <span className="text-[10px] text-slate-600 font-mono leading-tight self-center">{fmtTime(entry.timestamp)}</span>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold w-fit h-fit self-center", meta.bg, meta.color)}>
                <meta.icon className="w-2.5 h-2.5" />{meta.label}
              </span>
              <span className="text-slate-300 truncate self-center" title={entry.prompt}>
                {entry.prompt || <span className="text-slate-700 italic">—</span>}
                {entry.error && <span className="block text-[10px] text-red-400 mt-0.5 truncate">{entry.error}</span>}
              </span>
              <span className="text-slate-500 text-[11px] font-mono self-center">
                {fmtTok(totalTok)}
                {entry.cacheReadTokens > 0 && (
                  <span className="ml-1 text-green-500" title="cache hit">↺</span>
                )}
              </span>
              <span className={cn("text-[11px] font-mono self-center",
                entry.durationMs > 60000 ? "text-red-400" : entry.durationMs > 20000 ? "text-amber-400" : "text-slate-500")}>
                {fmtDur(entry.durationMs)}
              </span>
              <Badge variant="outline" className={cn("text-[10px] font-semibold px-1.5 py-0 border w-fit self-center",
                entry.status === "success"
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-red-400 border-red-500/30 bg-red-500/10")}>
                {entry.status}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-[12px] text-slate-500">
          <span>{data.total} entries · page {data.page} of {data.pages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => { setPage(page - 1); void load(page - 1, typeFilter, statusFilter); }}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => { setPage(p); void load(p, typeFilter, statusFilter); }}
                className={cn("w-7 h-7 rounded-lg border text-[11px] font-medium transition-colors",
                  p === page ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300" : "border-slate-800 hover:border-slate-700 hover:text-slate-300")}>
                {p}
              </button>
            ))}
            <button disabled={page >= data.pages} onClick={() => { setPage(page + 1); void load(page + 1, typeFilter, statusFilter); }}
              className="p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Token detail */}
      {stats && stats.total > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-[12px]">
          {[
            { label: "Input tokens",      value: fmtTok(stats.totalInputTokens) },
            { label: "Output tokens",     value: fmtTok(stats.totalOutputTokens) },
            { label: "Cache-read tokens", value: fmtTok(stats.totalCacheReadTokens) },
            { label: "Cache savings",     value: stats.totalInputTokens > 0
              ? `${Math.round(stats.totalCacheReadTokens / (stats.totalInputTokens + stats.totalCacheReadTokens) * 100)}%`
              : "0%" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-slate-600 mb-0.5">{label}</div>
              <div className="text-slate-300 font-semibold font-mono">{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab() {
  const [data, setData]       = useState<TasksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<"all" | ERPAITask["status"]>("all");
  const [busy, setBusy]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch("/api/sadmin/erpai/tasks");
      if (res.ok) setData(await res.json() as TasksResponse);
      else setError(`API error ${res.status}${res.status === 401 ? " — refresh the page" : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function cycleStatus(task: ERPAITask) {
    setBusy(task.id);
    const next = STATUS_CYCLE[task.status];
    await apiFetch(`/api/sadmin/erpai/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    void load();
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    setBusy(id);
    await apiFetch(`/api/sadmin/erpai/tasks/${id}`, { method: "DELETE" });
    setBusy(null);
    void load();
  }

  const tasks = data?.tasks.filter((t) => filter === "all" || t.status === filter) ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total",       value: stats.total,        color: "text-slate-300" },
            { label: "Todo",        value: stats.todo,         color: "text-slate-400" },
            { label: "In Progress", value: stats.in_progress,  color: "text-amber-400" },
            { label: "Done",        value: stats.done,         color: "text-green-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3">
              <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{label}</div>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter + refresh */}
      <div className="flex gap-2">
        {(["all", "todo", "in_progress", "done"] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn("px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all",
              filter === s
                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200")}>
            {s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}
          className="border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800">
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {loading && !data && (
          <div className="flex items-center justify-center py-12 text-slate-600 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500/60" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => void load()} className="text-[12px] text-slate-500 hover:text-slate-300 underline">Retry</button>
          </div>
        )}
        {!error && tasks.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-600">
            <ClipboardList className="w-8 h-8 opacity-30" />
            <p className="text-sm">No tasks.</p>
          </div>
        )}
        {tasks.map((task) => (
          <div key={task.id}
            className="bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-slate-700 transition-colors">
            {/* Status toggle */}
            <button onClick={() => void cycleStatus(task)} disabled={busy === task.id}
              className={cn("mt-0.5 shrink-0 transition-colors", STATUS_COLOR[task.status])}>
              {busy === task.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : task.status === "done" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Circle className="w-4 h-4" />
              )}
            </button>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={cn("text-[13px] font-medium",
                  task.status === "done" ? "line-through text-slate-600" : "text-slate-200")}>
                  {task.title}
                </span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0", PRIORITY_COLOR[task.priority])}>
                  {task.priority}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 font-medium shrink-0">
                  {task.category}
                </span>
              </div>
              <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">{task.description}</p>
            </div>

            {/* Delete */}
            <button onClick={() => void deleteTask(task.id)} disabled={busy === task.id}
              className="shrink-0 p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors mt-0.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

const MODELS = [
  { id: "claude-opus-4-7",   label: "Claude Opus 4.7",   note: "Most capable, highest cost" },
  { id: "claude-opus-4-6",   label: "Claude Opus 4.6",   note: "Powerful, stable" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Balanced speed & quality" },
  { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  note: "Fastest, lowest cost" },
];

function SettingsTab() {
  const [config, setConfig]   = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [draft, setDraft]     = useState<AIConfig | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null);
      try {
        const res = await apiFetch("/api/sadmin/erpai/config");
        if (res.ok) {
          const { config: cfg } = await res.json() as { config: AIConfig };
          setConfig(cfg); setDraft(cfg);
        } else {
          setError(`API returned ${res.status}${res.status === 401 ? " — session expired, refresh the page" : ""}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load config");
      } finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    if (!draft) return;
    setSaving(true); setSaved(false);
    await apiFetch("/api/sadmin/erpai/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setConfig(draft); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function patch(update: Partial<AIConfig>) {
    setDraft((d) => d ? { ...d, ...update } : d);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-14 text-slate-600 gap-2">
      <RefreshCw className="w-4 h-4 animate-spin" /> Loading config…
    </div>
  );

  if (error || !draft) return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-600">
      <AlertTriangle className="w-8 h-8 text-red-500/50" />
      <p className="text-sm text-red-400">{error ?? "Failed to load config"}</p>
      <button onClick={() => { setError(null); setLoading(true); void (async () => {
        try {
          const res = await apiFetch("/api/sadmin/erpai/config");
          if (res.ok) { const { config: cfg } = await res.json() as { config: AIConfig }; setConfig(cfg); setDraft(cfg); }
          else setError(`API returned ${res.status}`);
        } catch(e) { setError(e instanceof Error ? e.message : "Error"); }
        finally { setLoading(false); }
      })(); }}
        className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-colors">
        Retry
      </button>
    </div>
  );

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <div className="max-w-2xl space-y-6">
      {/* Model */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-slate-200 mb-1">AI Model</h2>
        <p className="text-[12px] text-slate-500 mb-4">The Claude model used for all ERPAI requests.</p>
        <div className="space-y-2">
          {MODELS.map((m) => (
            <button key={m.id} onClick={() => patch({ model: m.id })}
              className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left",
                draft.model === m.id
                  ? "border-cyan-500/40 bg-cyan-500/10"
                  : "border-slate-800 hover:border-slate-700 bg-slate-900/40")}>
              <div className={cn("w-3 h-3 rounded-full border-2 shrink-0 transition-colors",
                draft.model === m.id ? "border-cyan-400 bg-cyan-400" : "border-slate-600")} />
              <div>
                <div className={cn("text-[13px] font-medium", draft.model === m.id ? "text-cyan-300" : "text-slate-300")}>
                  {m.label}
                </div>
                <div className="text-[11px] text-slate-600">{m.note}</div>
              </div>
              {draft.model === m.id && (
                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  Active
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-slate-200 mb-1">Features</h2>
        <p className="text-[12px] text-slate-500 mb-4">Enable or disable ERPAI capabilities.</p>
        <div className="space-y-3">
          {([
            { key: "chat",        label: "AI Chat",          desc: "Streaming conversation with the codebase AI", icon: MessageSquare },
            { key: "analyze",     label: "Code Analysis",    desc: "Agentic file-reading analysis with tools", icon: Search },
            { key: "taskSuggest", label: "Task Suggestions", desc: "AI-generated development task recommendations", icon: Zap },
          ] as { key: keyof AIConfig["features"]; label: string; desc: string; icon: React.ElementType }[]).map(({ key, label, desc, icon: Icon }) => (
            <div key={key}
              className={cn("flex items-center gap-4 px-4 py-3 rounded-lg border transition-all",
                draft.features[key] ? "border-slate-700 bg-slate-900/20" : "border-slate-800/50 bg-slate-900/10 opacity-60")}>
              <Icon className={cn("w-4 h-4 shrink-0", draft.features[key] ? "text-cyan-400" : "text-slate-600")} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-200">{label}</div>
                <div className="text-[11px] text-slate-600">{desc}</div>
              </div>
              <button onClick={() => patch({ features: { ...draft.features, [key]: !draft.features[key] } })}
                className="shrink-0">
                {draft.features[key]
                  ? <ToggleRight className="w-7 h-7 text-cyan-400" />
                  : <ToggleLeft  className="w-7 h-7 text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Limits */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h2 className="text-[13px] font-semibold text-slate-200 mb-1">Limits</h2>
        <p className="text-[12px] text-slate-500 mb-4">Token budgets and iteration caps.</p>
        <div className="grid grid-cols-2 gap-4">
          {([
            { key: "chatMaxTokens",        label: "Chat max tokens",     min: 1024,  max: 200000, step: 1024 },
            { key: "analyzeMaxTokens",     label: "Analyze max tokens",  min: 1024,  max: 64000,  step: 1024 },
            { key: "analyzeMaxIterations", label: "Analyze max rounds",  min: 1,     max: 30,     step: 1 },
            { key: "maxLogEntries",        label: "Max log entries",     min: 10,    max: 5000,   step: 10 },
          ] as { key: keyof AIConfig; label: string; min: number; max: number; step: number }[]).map(({ key, label, min, max, step }) => (
            <div key={key}>
              <label className="block text-[11px] text-slate-500 mb-1.5 font-medium">{label}</label>
              <input
                type="number" min={min} max={max} step={step}
                value={draft[key] as number}
                onChange={(e) => patch({ [key]: parseInt(e.target.value, 10) } as Partial<AIConfig>)}
                className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-[13px] text-slate-200 font-mono outline-none focus:border-cyan-500/60 transition-colors"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={saving || !isDirty}
          className={cn("bg-cyan-600 hover:bg-cyan-500 text-white font-semibold",
            (!isDirty && !saving) && "opacity-50 cursor-not-allowed")}>
          {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : <><Save className="w-3.5 h-3.5 mr-1.5" />Save changes</>}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-[12px] text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
          </span>
        )}
        {isDirty && !saving && (
          <span className="text-[11px] text-slate-600">Unsaved changes</span>
        )}
      </div>
    </div>
  );
}
