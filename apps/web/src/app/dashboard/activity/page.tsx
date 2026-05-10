"use client";

import { useEffect, useState } from "react";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { toast } from "sonner";

type LogEntry = {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type LogResponse = { logs: LogEntry[]; total: number; page: number; pages: number };

const ENTITY_COLORS: Record<string, string> = {
  lead:          "bg-blue-100 text-blue-700",
  deal:          "bg-violet-100 text-violet-700",
  customer:      "bg-emerald-100 text-emerald-700",
  product:       "bg-amber-100 text-amber-700",
  invoice:       "bg-rose-100 text-rose-700",
  employee:      "bg-cyan-100 text-cyan-700",
  project:       "bg-indigo-100 text-indigo-700",
  task:          "bg-orange-100 text-orange-700",
  leaveRequest:  "bg-pink-100 text-pink-700",
};

function EntityBadge({ entity }: { entity: string }) {
  const cls = ENTITY_COLORS[entity] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize ${cls}`}>
      {entity}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ActivityPage() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [loading, setLoading] = useState(true);

  function load(p: number, e: string) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "50" });
    if (e) params.set("entity", e);

    apiGet<LogResponse>(`/api/activity?${params.toString()}`)
      .then(setData)
      .catch(() => toast.error("Failed to load activity log"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(page, entity); }, [page, entity]);

  const entities = Object.keys(ENTITY_COLORS);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-muted-foreground text-sm mt-1">All actions taken by your team.</p>
        </div>
        {data && (
          <p className="text-sm text-muted-foreground">{data.total} event{data.total !== 1 ? "s" : ""}</p>
        )}
      </div>

      {/* Entity filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setEntity(""); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            !entity ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          All
        </button>
        {entities.map((e) => (
          <button
            key={e}
            onClick={() => { setEntity(e); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
              entity === e ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="rounded-xl border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : !data?.logs.length ? (
          <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Activity className="w-8 h-8 opacity-30" />
            <p className="text-sm">No activity yet. Actions taken in modules will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Entity</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium capitalize">{log.action.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3"><EntityBadge entity={log.entity} /></td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{log.entityId ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs font-mono">{log.userId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{timeAgo(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {data.page} of {data.pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
