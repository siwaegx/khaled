"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/types";

// Simple markdown renderer (code blocks + bold + inline code)
function renderMarkdown(text: string): string {
  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
      const l = lang || "text";
      return `<pre><code class="lang-${l}">${escHtml(code.trimEnd())}</code></pre>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hupol]|<pre)(.+)$/gm, "$1");
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const SUGGESTIONS = [
  "What are the biggest gaps in the codebase?",
  "Review the auth flow for security issues",
  "How does the module system work?",
  "What tests are missing?",
  "Explain the multi-tenant database architecture",
  "What's the difference between platform admin and tenant roles?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Placeholder assistant message
    setMessages([...newMessages, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              content += parsed.text;
              setMessages([
                ...newMessages,
                { role: "assistant", content },
              ]);
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages([
        ...newMessages,
        { role: "assistant", content: `❌ Error: ${errMsg}` },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
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
        <Link
          href="/"
          style={{
            color: "var(--muted)",
            textDecoration: "none",
            fontSize: 18,
          }}
        >
          ←
        </Link>
        <span style={{ fontSize: 18 }}>💬</span>
        <span style={{ fontWeight: 600, color: "var(--accent2)" }}>AI Chat</span>
        <span style={{ flex: 1 }} />
        {streaming && (
          <span
            style={{ fontSize: 12, color: "var(--accent)", animation: "pulse 1s infinite" }}
          >
            ⚡ Thinking…
          </span>
        )}
        <button
          onClick={() => setMessages([])}
          style={{
            fontSize: 12,
            color: "var(--muted)",
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: "pointer",
          }}
        >
          Clear
        </button>
      </header>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 0",
        }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 20px" }}>
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
              <h2
                style={{
                  color: "var(--accent2)",
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                ERPAI is ready
              </h2>
              <p style={{ color: "var(--muted)", marginBottom: 32, fontSize: 13 }}>
                I know everything about Business360. Ask me anything.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  maxWidth: 560,
                  margin: "0 auto",
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    style={{
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      color: "var(--text)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "left",
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
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: 20,
                display: "flex",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background:
                    msg.role === "user" ? "var(--accent)" : "#1e2040",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  flexShrink: 0,
                  border: "1px solid var(--border)",
                }}
              >
                {msg.role === "user" ? "👤" : "🤖"}
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: "80%",
                  background:
                    msg.role === "user" ? "#1a1c3a" : "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: msg.role === "user" ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                  padding: "12px 16px",
                }}
              >
                {msg.role === "assistant" && msg.content === "" && streaming ? (
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                    ▋
                  </span>
                ) : msg.role === "assistant" ? (
                  <div
                    className="prose"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content),
                    }}
                    style={{ fontSize: 13, lineHeight: 1.7 }}
                  />
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          borderTop: "1px solid var(--border)",
          background: "var(--bg2)",
          padding: "12px 20px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            disabled={streaming}
            placeholder="Ask ERPAI anything about the codebase… (Enter to send, Shift+Enter for newline)"
            rows={1}
            style={{
              flex: 1,
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text)",
              padding: "10px 14px",
              fontSize: 13,
              resize: "none",
              outline: "none",
              maxHeight: 160,
              overflowY: "auto",
              lineHeight: 1.5,
              fontFamily: "inherit",
            }}
            onInput={(e) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 160) + "px";
            }}
          />
          <button
            onClick={send}
            disabled={streaming || !input.trim()}
            style={{
              background: streaming || !input.trim() ? "var(--bg3)" : "var(--accent)",
              color: streaming || !input.trim() ? "var(--muted)" : "#fff",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 18px",
              cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 13,
              transition: "background 0.15s",
              height: 42,
            }}
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
        <div
          style={{
            maxWidth: 860,
            margin: "6px auto 0",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          Powered by Claude Opus 4.7 with adaptive thinking + prompt caching
        </div>
      </div>
    </div>
  );
}
