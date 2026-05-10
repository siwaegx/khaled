"use client";

import { useState } from "react";
import Link from "next/link";

const PRESETS = [
  {
    label: "Security Audit",
    prompt:
      "Perform a security audit of the Business360 codebase. Read the auth routes, middleware files, and check for common vulnerabilities: SQL injection, XSS, IDOR, missing auth guards, insecure JWT handling, and input validation gaps.",
  },
  {
    label: "Find Missing Tests",
    prompt:
      "Analyze the test coverage of Business360. List the API routes and key modules, then identify which ones have no test files or very thin coverage. Prioritize by risk.",
  },
  {
    label: "Performance Review",
    prompt:
      "Review the Business360 codebase for performance issues. Check for: N+1 queries, missing database indexes, unoptimized Prisma queries, large payload responses, and frontend re-render bottlenecks.",
  },
  {
    label: "Module Architecture",
    prompt:
      "Explain how the Business360 module system works. Read the module manifest files, registerModules.ts, route_registry.ts, and the module-sdk. Then describe exactly how a new module gets discovered, registered, and served.",
  },
  {
    label: "Dead Code",
    prompt:
      "Find dead code, unused exports, and leftover TODO/FIXME comments in the Business360 codebase. Focus on apps/api/src and apps/web/src.",
  },
  {
    label: "TypeScript Strictness",
    prompt:
      "Review the TypeScript quality of the Business360 codebase. Find: any-type usages, missing return types on exported functions, type assertions that could be removed, and interfaces that should be stricter.",
  },
];

function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const l = lang || "text";
      return `<pre><code class="lang-${l}">${escHtml(code.trimEnd())}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$1. $2</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hupol]|<pre)(.+)$/gm, "$1");
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function AnalyzePage() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);

  async function run() {
    const p = prompt.trim();
    if (!p || loading) return;

    setLoading(true);
    setResult("");
    setError("");
    const start = Date.now();

    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000
    );

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      const data = await res.json();
      setResult(data.analysis ?? JSON.stringify(data));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      clearInterval(timer);
      setElapsed(Math.floor((Date.now() - start) / 1000));
      setLoading(false);
    }
  }

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
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 18 }}>
          ←
        </Link>
        <span style={{ fontSize: 18 }}>🔍</span>
        <span style={{ fontWeight: 600, color: "var(--accent2)" }}>Code Analysis</span>
        <span style={{ flex: 1 }} />
        {loading && (
          <span style={{ fontSize: 12, color: "var(--yellow)" }}>
            ⚡ Analyzing… {elapsed}s
          </span>
        )}
      </header>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 1000,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Presets */}
        <div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginBottom: 10,
              fontWeight: 500,
            }}
          >
            Quick analysis presets:
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setPrompt(p.prompt)}
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "5px 12px",
                  color: "var(--text)",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--accent)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.borderColor =
                    "var(--border)")
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            placeholder="Describe what to analyze… e.g. 'Review the CRM module for bugs and suggest improvements'"
            rows={4}
            style={{
              width: "100%",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
              padding: "12px 14px",
              fontSize: 13,
              resize: "vertical",
              outline: "none",
              fontFamily: "inherit",
              lineHeight: 1.6,
            }}
          />
          <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
            <button
              onClick={run}
              disabled={loading || !prompt.trim()}
              style={{
                background:
                  loading || !prompt.trim() ? "var(--bg3)" : "var(--accent)",
                color: loading || !prompt.trim() ? "var(--muted)" : "#fff",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "9px 22px",
                cursor: loading || !prompt.trim() ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {loading ? `Analyzing… (${elapsed}s)` : "Run Analysis"}
            </button>
            {result && (
              <button
                onClick={() => { setResult(""); setPrompt(""); }}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "9px 16px",
                  color: "var(--muted)",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Claude reads your actual files — no hallucination. Can take 30–120 seconds for deep analysis.
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, marginBottom: 6, color: "var(--accent2)" }}>
              Reading your codebase…
            </div>
            <div style={{ fontSize: 12 }}>
              Claude is using tools to read files and grep the source code.
              This may take a minute.
            </div>
            <div
              style={{
                marginTop: 16,
                height: 4,
                background: "var(--border)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "var(--accent)",
                  width: "40%",
                  animation: "slide 1.5s ease-in-out infinite",
                }}
              />
            </div>
            <style>{`
              @keyframes slide {
                0% { transform: translateX(-100%); width: 40%; }
                100% { transform: translateX(300%); width: 40%; }
              }
            `}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "#1a0808",
              border: "1px solid #3f1010",
              borderRadius: 10,
              padding: "14px 16px",
              color: "var(--red)",
              fontSize: 13,
            }}
          >
            ❌ {error}
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--accent2)", fontSize: 14 }}>
                Analysis Result
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {elapsed}s
              </span>
            </div>
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(result) }}
              style={{ fontSize: 13, lineHeight: 1.75 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
