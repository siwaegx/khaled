import { NextRequest, NextResponse } from "next/server";
import {
  loadTasks,
  createTask,
  updateTask,
  deleteTask,
} from "@/lib/tasks";
import { anthropic, getSystemBlocks, MODEL } from "@/lib/claude";
import { appendLog } from "@/lib/ai-log";
import { requireAuth } from "@/lib/requireAuth";
import type { Task } from "@/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(loadTasks());
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();

  // AI-suggest tasks based on codebase
  if (body.action === "ai_suggest") {
    const systemBlocks = getSystemBlocks();
    const focus: string = body.focus || "bugs, missing tests, UX improvements, and new features";
    const startMs = Date.now();

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: systemBlocks as any,
        messages: [
          {
            role: "user",
            content: `Based on the Business360 codebase, suggest 5 concrete, actionable development tasks.
Focus: ${focus}

Return a JSON array ONLY — no markdown, no explanation, just the array:
[
  {
    "title": "short task title",
    "description": "what needs to be done and why (2-3 sentences)",
    "priority": "high|medium|low",
    "category": "bug|feature|refactor|test|docs"
  }
]`,
          },
        ],
      });

      appendLog({
        type: "task_suggest",
        prompt: `Suggest tasks — Focus: ${focus}`.slice(0, 200),
        model: MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cacheReadTokens: (response.usage as any).cache_read_input_tokens ?? 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cacheCreationTokens: (response.usage as any).cache_creation_input_tokens ?? 0,
        durationMs: Date.now() - startMs,
        status: "success",
      });

      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("");

      try {
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) {
          const suggestions = JSON.parse(match[0]);
          return NextResponse.json({ suggestions });
        }
      } catch {}

      return NextResponse.json({ suggestions: [], raw });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : "Unknown error";
      appendLog({
        type: "task_suggest",
        prompt: `Suggest tasks — Focus: ${focus}`.slice(0, 200),
        model: MODEL,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        durationMs: Date.now() - startMs,
        status: "error",
        error,
      });
      return NextResponse.json({ error }, { status: 500 });
    }
  }

  // Create a new task
  const task = createTask({
    title: body.title,
    description: body.description ?? "",
    status: (body.status as Task["status"]) ?? "todo",
    priority: (body.priority as Task["priority"]) ?? "medium",
    category: (body.category as Task["category"]) ?? "feature",
  });

  return NextResponse.json(task);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id, ...data } = await req.json();
  const task = updateTask(id, data);
  if (!task)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await req.json();
  const ok = deleteTask(id);
  if (!ok)
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
