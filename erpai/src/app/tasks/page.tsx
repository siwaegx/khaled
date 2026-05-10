"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Task, TaskSuggestion } from "@/types";

const STATUSES: Task["status"][] = ["todo", "in_progress", "done"];
const STATUS_LABELS = { todo: "To Do", in_progress: "In Progress", done: "Done" };
const STATUS_COLORS = {
  todo: "var(--muted)",
  in_progress: "var(--yellow)",
  done: "var(--green)",
};

const PRIORITY_MAP = {
  high: { bg: "#3f1010", color: "var(--red)" },
  medium: { bg: "#302008", color: "var(--yellow)" },
  low: { bg: "#0d2010", color: "var(--green)" },
};

const CATEGORY_ICONS = {
  bug: "🐛",
  feature: "✨",
  refactor: "♻️",
  test: "🧪",
  docs: "📝",
};

const FOCUS_OPTIONS = [
  "bugs and security issues",
  "missing tests and test coverage",
  "UX improvements and new features",
  "performance and optimization",
  "documentation and code quality",
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [focus, setFocus] = useState(FOCUS_OPTIONS[0]);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<Task["status"] | "all">("all");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    category: "feature" as Task["category"],
  });

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: Task[]) => { setTasks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function createTask() {
    if (!newTask.title.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTask, status: "todo" }),
      });
      const task: Task = await res.json();
      setTasks((prev) => [...prev, task]);
      setNewTask({ title: "", description: "", priority: "medium", category: "feature" });
      setShowNew(false);
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus(id: string, status: Task["status"]) {
    const res = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const updated: Task = await res.json();
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function deleteTask(id: string) {
    await fetch("/api/tasks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function aiSuggest() {
    setSuggesting(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai_suggest", focus }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } finally {
      setSuggesting(false);
    }
  }

  async function addSuggestion(s: TaskSuggestion) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, status: "todo" }),
    });
    const task: Task = await res.json();
    setTasks((prev) => [...prev, task]);
    setSuggestions((prev) => prev.filter((x) => x.title !== s.title));
  }

  const filtered =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
          padding: "0 20px",
          height: 52,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 18 }}>←</Link>
        <span style={{ fontSize: 18 }}>📋</span>
        <span style={{ fontWeight: 600, color: "var(--accent2)" }}>Tasks</span>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>({tasks.length})</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => setShowNew(true)}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Task
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>

          {/* AI Suggest */}
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              display: "flex",
              gap: 12,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 18 }}>🤖</span>
            <span style={{ fontSize: 13, color: "var(--accent2)", fontWeight: 500 }}>
              AI Task Suggestions
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Focus:</span>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text)",
                padding: "4px 8px",
                fontSize: 12,
              }}
            >
              {FOCUS_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <button
              onClick={aiSuggest}
              disabled={suggesting}
              style={{
                background: suggesting ? "var(--bg3)" : "#1e1060",
                color: suggesting ? "var(--muted)" : "var(--accent2)",
                border: "1px solid var(--accent)",
                borderRadius: 7,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: suggesting ? "not-allowed" : "pointer",
              }}
            >
              {suggesting ? "Analyzing codebase…" : "Suggest Tasks"}
            </button>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div
              style={{
                background: "#0d0e1a",
                border: "1px solid var(--accent)",
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--accent2)", marginBottom: 12, fontSize: 13 }}>
                ✨ AI Suggested Tasks — click to add
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {suggestions.map((s) => (
                  <div
                    key={s.title}
                    style={{
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {CATEGORY_ICONS[s.category]}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 3 }}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {s.description}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                      <PriorityBadge priority={s.priority} />
                      <button
                        onClick={() => addSuggestion(s)}
                        style={{
                          background: "var(--accent)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {(["all", ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  background: filter === s ? "var(--accent)" : "var(--bg2)",
                  color: filter === s ? "#fff" : "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: filter === s ? 600 : 400,
                }}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]}{" "}
                <span style={{ opacity: 0.7 }}>
                  ({s === "all" ? tasks.length : tasks.filter((t) => t.status === s).length})
                </span>
              </button>
            ))}
          </div>

          {/* Task list */}
          {loading ? (
            <div style={{ color: "var(--muted)", padding: 24, textAlign: "center" }}>
              Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                color: "var(--muted)",
                padding: 40,
                textAlign: "center",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              No tasks. Create one or let AI suggest some.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onStatusChange={updateStatus}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Task Modal */}
      {showNew && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && setShowNew(false)}
        >
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 500,
            }}
          >
            <h2 style={{ color: "var(--accent2)", fontWeight: 600, marginBottom: 18, fontSize: 15 }}>
              New Task
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                value={newTask.title}
                onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                placeholder="Task title *"
                autoFocus
                style={inputStyle}
              />
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description (optional)"
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  value={newTask.priority}
                  onChange={(e) =>
                    setNewTask((p) => ({ ...p, priority: e.target.value as Task["priority"] }))
                  }
                  style={inputStyle}
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </select>
                <select
                  value={newTask.category}
                  onChange={(e) =>
                    setNewTask((p) => ({ ...p, category: e.target.value as Task["category"] }))
                  }
                  style={inputStyle}
                >
                  <option value="bug">🐛 Bug</option>
                  <option value="feature">✨ Feature</option>
                  <option value="refactor">♻️ Refactor</option>
                  <option value="test">🧪 Test</option>
                  <option value="docs">📝 Docs</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowNew(false)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    padding: "8px 16px",
                    color: "var(--muted)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  disabled={creating || !newTask.title.trim()}
                  style={{
                    background:
                      creating || !newTask.title.trim() ? "var(--bg3)" : "var(--accent)",
                    color: creating || !newTask.title.trim() ? "var(--muted)" : "#fff",
                    border: "none",
                    borderRadius: 7,
                    padding: "8px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: creating || !newTask.title.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (id: string, status: Task["status"]) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 16px",
        opacity: task.status === "done" ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Status toggle */}
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            border: `2px solid ${STATUS_COLORS[task.status]}`,
            background:
              task.status === "done" ? STATUS_COLORS[task.status] : "transparent",
            cursor: "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
          }}
          title="Cycle status"
          onClick={() => {
            const next: Record<Task["status"], Task["status"]> = {
              todo: "in_progress",
              in_progress: "done",
              done: "todo",
            };
            onStatusChange(task.id, next[task.status]);
          }}
        >
          {task.status === "done" && "✓"}
        </div>

        <span style={{ fontSize: 14, flexShrink: 0 }}>{CATEGORY_ICONS[task.category]}</span>

        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: task.status === "done" ? "line-through" : "none",
            color: task.status === "done" ? "var(--muted)" : "var(--text)",
            cursor: task.description ? "pointer" : "default",
          }}
          onClick={() => task.description && setExpanded((p) => !p)}
        >
          {task.title}
        </span>

        <PriorityBadge priority={task.priority} />

        <span
          style={{
            fontSize: 11,
            color: STATUS_COLORS[task.status],
            background:
              task.status === "todo"
                ? "#1a1c2a"
                : task.status === "in_progress"
                ? "#2a2008"
                : "#0d2010",
            padding: "2px 8px",
            borderRadius: 4,
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          {STATUS_LABELS[task.status]}
        </span>

        <button
          onClick={() => onDelete(task.id)}
          style={{
            background: "none",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            fontSize: 14,
            padding: "2px 6px",
            borderRadius: 4,
          }}
          title="Delete"
        >
          ✕
        </button>
      </div>

      {expanded && task.description && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.6,
          }}
        >
          {task.description}
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const s = PRIORITY_MAP[priority];
  return (
    <span
      style={{
        fontSize: 10,
        background: s.bg,
        color: s.color,
        padding: "2px 7px",
        borderRadius: 4,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {priority}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "var(--bg3)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  padding: "9px 12px",
  fontSize: 13,
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};
