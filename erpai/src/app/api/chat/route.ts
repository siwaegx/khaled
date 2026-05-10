import { NextRequest, NextResponse } from "next/server";
import { anthropic, getSystemBlocks, MODEL } from "@/lib/claude";
import { appendLog } from "@/lib/ai-log";
import { getConfig } from "@/lib/ai-config";
import { requireAuth } from "@/lib/requireAuth";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const config = getConfig();
  if (!config.features.chat) {
    return new Response(
      `data: ${JSON.stringify({ error: "Chat feature is disabled by the platform admin." })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }
    );
  }

  const { messages }: { messages: ChatMessage[] } = await req.json();

  const systemBlocks = getSystemBlocks();
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
          model: MODEL,
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
