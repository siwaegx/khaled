import { NextRequest, NextResponse } from "next/server";
import { anthropic, getSystemBlocks, MODEL } from "@/lib/claude";
import { appendLog } from "@/lib/ai-log";
import { getConfig } from "@/lib/ai-config";
import { requireAuth } from "@/lib/requireAuth";
import type { ChatMessage } from "@/types";

// Simple in-memory per-user rate limiter: max 20 chat calls per minute
const chatRateMap = new Map<string, { count: number; resetAt: number }>();
function checkChatRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = chatRateMap.get(userId);
  if (!entry || entry.resetAt < now) {
    chatRateMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

export const runtime = "nodejs";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function fetchOrgContext(accessToken: string | undefined): Promise<string | null> {
  if (!accessToken) return null;
  try {
    const res = await fetch(`${API_URL}/api/reports/summary`, {
      headers: { Cookie: `access_token=${accessToken}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const context = await res.json();
    return `--- ORG CONTEXT (live data, use to answer questions about this organization) ---
CRM: ${context.crm.leads} leads, ${context.crm.customers} customers, ${context.crm.deals} open deals worth ${context.crm.dealValue}
Accounting: ${context.accounting.paidRevenue} revenue, ${context.accounting.totalExpenses} expenses, ${context.accounting.invoices} invoices
HR: ${context.hr.activeEmployees} employees, ${context.hr.pendingLeave} pending leave requests
Projects: ${context.projects.activeProjects} projects, ${context.projects.openTasks} open tasks
Inventory: ${context.inventory.products} products, ${context.inventory.warehouses} warehouses
---`;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Rate limit: 20 chat requests per user per minute
  if (!checkChatRateLimit(auth.user.userId)) {
    return NextResponse.json({ error: "Rate limit exceeded. Maximum 20 chat requests per minute." }, { status: 429 });
  }

  const config = getConfig();
  if (!config.features.chat) {
    return new Response(
      `data: ${JSON.stringify({ error: "Chat feature is disabled by the platform admin." })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const body = await req.json() as Record<string, unknown>;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array is required and must not be empty." }, { status: 400 });
  }
  if (body.messages.length > 100) {
    return NextResponse.json({ error: "Too many messages. Maximum 100 messages per request." }, { status: 400 });
  }
  const messages = body.messages as ChatMessage[];

  // Build system blocks — start with the cached base blocks, then optionally
  // append a live org context block (not cached, changes per request).
  const accessToken = req.cookies.get("access_token")?.value;
  const orgContextText = await fetchOrgContext(accessToken);

  const systemBlocks = [
    ...getSystemBlocks(),
    ...(orgContextText
      ? [{ type: "text" as const, text: orgContextText }]
      : []),
  ];
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const promptPreview = (lastUserMsg?.content ?? "").slice(0, 200);
  const startMs = Date.now();

  const stream = anthropic.messages.stream({
    model: config.model ?? MODEL,
    max_tokens: config.chatMaxTokens ?? 64000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thinking: { type: "adaptive" } as any,
    system: systemBlocks as any,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      let logStatus: "success" | "error" = "success";
      let logError: string | undefined;
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadTokens = 0;
      let cacheCreationTokens = 0;

      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              )
            );
          }
          if (event.type === "message_delta" && "usage" in event) {
            const u = (event as { usage?: { output_tokens?: number } }).usage;
            outputTokens = u?.output_tokens ?? 0;
          }
        }
        const finalMsg = await stream.finalMessage();
        inputTokens = finalMsg.usage.input_tokens;
        outputTokens = finalMsg.usage.output_tokens;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cacheReadTokens = (finalMsg.usage as any).cache_read_input_tokens ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cacheCreationTokens = (finalMsg.usage as any).cache_creation_input_tokens ?? 0;
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err: unknown) {
        logStatus = "error";
        logError = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: logError })}\n\n`)
        );
      } finally {
        controller.close();
        appendLog({
          type: "chat",
          prompt: promptPreview,
          model: config.model ?? MODEL,
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheCreationTokens,
          durationMs: Date.now() - startMs,
          status: logStatus,
          ...(logError ? { error: logError } : {}),
        });
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
