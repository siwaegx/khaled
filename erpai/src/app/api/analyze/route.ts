import { NextRequest, NextResponse } from "next/server";
import { anthropic, getSystemBlocks, MODEL } from "@/lib/claude";
import { readFile, listDirectory, grepCode, getRepoRoot } from "@/lib/codebase";
import { appendLog } from "@/lib/ai-log";
import { getConfig } from "@/lib/ai-config";
import { requireAuth } from "@/lib/requireAuth";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "read_file",
    description:
      "Read the full contents of a file in the Business360 codebase. Use relative paths from the repo root.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "File path relative to repo root (e.g. apps/api/src/routes/auth.ts)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "list_directory",
    description: "List the contents of a directory (relative to repo root).",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to repo root",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "grep_code",
    description:
      "Search for a pattern across the codebase. Returns matching lines with file:line references.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: {
          type: "string",
          description: "Regex or literal string to search for",
        },
        directory: {
          type: "string",
          description:
            "Optional: restrict search to this directory (relative to repo root)",
        },
        extensions: {
          type: "array",
          items: { type: "string" },
          description: "File extensions to include (default: .ts, .tsx, .js)",
        },
      },
      required: ["pattern"],
    },
  },
];

function executeTool(name: string, input: Record<string, unknown>): string {
  if (name === "read_file") {
    const content = readFile(input.path as string);
    if (!content) return `Error: file not found — ${input.path}`;
    // Limit to 12 KB per file to keep context manageable
    return content.length > 12000
      ? content.slice(0, 12000) + "\n… (truncated)"
      : content;
  }

  if (name === "list_directory") {
    const entries = listDirectory(input.path as string);
    if (!entries.length) return `Directory empty or not found: ${input.path}`;
    return entries.join("\n");
  }

  if (name === "grep_code") {
    const results = grepCode(
      input.pattern as string,
      (input.directory as string) || "",
      (input.extensions as string[]) || [".ts", ".tsx", ".js"]
    );
    if (!results.length) return "No matches found.";
    return results.slice(0, 60).join("\n");
  }

  return `Unknown tool: ${name}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const config = getConfig();
  if (!config.features.analyze) {
    return NextResponse.json({ error: "Analysis feature is disabled by the platform admin." }, { status: 403 });
  }

  const { prompt }: { prompt: string } = await req.json();

  const systemBlocks = getSystemBlocks();
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  let iterations = 0;
  const MAX = config.analyzeMaxIterations ?? 12;
  const startMs = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheRead = 0;
  let totalCacheCreation = 0;

  try {
    while (iterations < MAX) {
      iterations++;

      const response = await anthropic.messages.create({
        model: config.model ?? MODEL,
        max_tokens: config.analyzeMaxTokens ?? 16000,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        thinking: { type: "adaptive" } as any,
        system: systemBlocks as any,
        tools: TOOLS,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalCacheRead += (response.usage as any).cache_read_input_tokens ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      totalCacheCreation += (response.usage as any).cache_creation_input_tokens ?? 0;

      if (response.stop_reason === "end_turn") {
        const text = response.content
          .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        appendLog({
          type: "analyze",
          prompt: prompt.slice(0, 200),
          model: MODEL,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          cacheReadTokens: totalCacheRead,
          cacheCreationTokens: totalCacheCreation,
          durationMs: Date.now() - startMs,
          status: "success",
        });
        return NextResponse.json({ analysis: text, repoRoot: getRepoRoot() });
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] =
          response.content
            .filter(
              (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
            )
            .map((b) => ({
              type: "tool_result" as const,
              tool_use_id: b.id,
              content: executeTool(b.name, b.input as Record<string, unknown>),
            }));

        messages.push({ role: "user", content: toolResults });
      } else {
        break;
      }
    }

    appendLog({
      type: "analyze",
      prompt: prompt.slice(0, 200),
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      durationMs: Date.now() - startMs,
      status: "success",
    });
    return NextResponse.json({
      analysis: "Analysis reached iteration limit. Try a more specific prompt.",
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : "Unknown error";
    appendLog({
      type: "analyze",
      prompt: prompt.slice(0, 200),
      model: MODEL,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      durationMs: Date.now() - startMs,
      status: "error",
      error,
    });
    return NextResponse.json({ error }, { status: 500 });
  }
}
