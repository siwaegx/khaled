import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "data", "ai-log.json");
const MAX_ENTRIES = 500;

export interface AILogEntry {
  id: string;
  timestamp: string;
  type: "chat" | "analyze" | "task_suggest";
  prompt: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  durationMs: number;
  status: "success" | "error";
  error?: string;
}

function readLog(): AILogEntry[] {
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as AILogEntry[];
  } catch {
    return [];
  }
}

export function appendLog(entry: Omit<AILogEntry, "id" | "timestamp">): void {
  try {
    const entries = readLog();
    const full: AILogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    entries.push(full);
    // Keep the log bounded — drop the oldest entries when over limit
    const trimmed = entries.length > MAX_ENTRIES ? entries.slice(-MAX_ENTRIES) : entries;
    fs.writeFileSync(LOG_PATH, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch {
    // Never throw — logging must not break the main request path
  }
}

export function getLog(): AILogEntry[] {
  return readLog();
}
