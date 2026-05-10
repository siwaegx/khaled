"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Task } from "@/types";

const NAV = [
  { href: "/chat", label: "Chat", icon: "💬", desc: "Talk to the AI agent" },
  { href: "/analyze", label: "Analyze", icon: "🔍", desc: "Deep code analysis" },
  { href: "/tasks", label: "Tasks", icon: "📋", desc: "Manage dev tasks" },
];

const PHASES = [
  "Phase 0–8: Foundation → All Modules",
  "Phase 17–18: Sadmin + Plans",
  "Phase 19: Full Test Coverage",
  "Phase 20: Email + Stripe + Playwright",
  "Phase 21: RBAC + Global Search + API Keys",
  "Phase 22–24: Invites + Contacts + Settings",
  "Phase 25: Full Audit & Fix",
  "Phase 26: Notifications, Calendar, Webhooks, Widgets",
];

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((data: Task[]) => {
        setTasks(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const todo = tasks.filter((t) => t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const highPriority = tasks.filter(
    (t) => t.priority === "high" && t.status !== "done"
  ).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🤖</span>
          <span style={{ fontWeight: 700, fontSize: 18, color: "var(--accent2)" }}>
            ERPAI
          </span>
          <span
            style={{
              fontSize: 11,
              background: "#1e2040",
              color: "var(--accent2)",
              padding: "2px 8px",
              borderRadius: 99,
              border: "1px solid var(--border)",
            }}
          >
            claude-opus-4-7
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "var(--green)",
            display: "inline-block",
            boxShadow: "0 0 6px var(--green)",
          }}
        />
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Online 24/7</span>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 8,
            }}
          >
            Business360 Developer Agent
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            I know your entire codebase. Ask me anything, run deep analysis, or
            let me manage your dev tasks — any time.
          </p>
        </div>

        {/* Quick actions */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginBottom: 36,
          }}
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "24px 20px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor =
                    "var(--accent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor =
                    "var(--border)")
                }
              >
                <span style={{ fontSize: 28 }}>{item.icon}</span>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      color: "var(--accent2)",
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 36,
          }}
        >
          {[
            { label: "To Do", value: loading ? "…" : todo, color: "var(--muted)" },
            {
              label: "In Progress",
              value: loading ? "…" : inProgress,
              color: "var(--yellow)",
            },
            { label: "Done", value: loading ? "…" : done, color: "var(--green)" },
            {
              label: "High Priority",
              value: loading ? "…" : highPriority,
              color: "var(--red)",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "16px 18px",
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: stat.color,
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          {/* Completed Phases */}
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <h2
              style={{
                fontWeight: 600,
                color: "var(--accent2)",
                marginBottom: 14,
                fontSize: 14,
              }}
            >
              ✅ Completed Phases
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {PHASES.map((p) => (
                <div
                  key={p}
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      color: "var(--green)",
                      fontWeight: 700,
                      fontSize: 10,
                    }}
                  >
                    ✓
                  </span>
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Recent tasks */}
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
              }}
            >
              <h2 style={{ fontWeight: 600, color: "var(--accent2)", fontSize: 14 }}>
                📋 Recent Tasks
              </h2>
              <Link
                href="/tasks"
                style={{
                  fontSize: 12,
                  color: "var(--accent)",
                  textDecoration: "none",
                }}
              >
                View all →
              </Link>
            </div>
            {loading ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading…</div>
            ) : tasks.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                No tasks yet.{" "}
                <Link
                  href="/tasks"
                  style={{ color: "var(--accent)", textDecoration: "none" }}
                >
                  Create one →
                </Link>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tasks.slice(-5).reverse().map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: "var(--bg3)",
                      borderRadius: 6,
                    }}
                  >
                    <StatusDot status={t.status} />
                    <span
                      style={{
                        fontSize: 12,
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                    </span>
                    <PriorityBadge priority={t.priority} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 40,
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 12,
          }}
        >
          ERPAI • Powered by Claude Opus 4.7 with prompt caching • Business360
          Developer Agent
        </div>
      </main>
    </div>
  );
}

function StatusDot({ status }: { status: Task["status"] }) {
  const colors = {
    todo: "var(--muted)",
    in_progress: "var(--yellow)",
    done: "var(--green)",
  };
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: colors[status],
        flexShrink: 0,
      }}
    />
  );
}

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const map = {
    high: { bg: "#3f1010", color: "var(--red)", label: "high" },
    medium: { bg: "#302008", color: "var(--yellow)", label: "med" },
    low: { bg: "#0d2010", color: "var(--green)", label: "low" },
  };
  const s = map[priority];
  return (
    <span
      style={{
        fontSize: 10,
        background: s.bg,
        color: s.color,
        padding: "1px 6px",
        borderRadius: 4,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {s.label}
    </span>
  );
}
