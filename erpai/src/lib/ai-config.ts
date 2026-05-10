import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "data", "ai-config.json");

export interface AIConfig {
  model: string;
  features: {
    chat: boolean;
    analyze: boolean;
    taskSuggest: boolean;
  };
  maxLogEntries: number;
  chatMaxTokens: number;
  analyzeMaxTokens: number;
  analyzeMaxIterations: number;
}

const DEFAULTS: AIConfig = {
  model: "claude-opus-4-7",
  features: { chat: true, analyze: true, taskSuggest: true },
  maxLogEntries: 500,
  chatMaxTokens: 64000,
  analyzeMaxTokens: 16000,
  analyzeMaxIterations: 12,
};

export function getConfig(): AIConfig {
  try {
    const stored = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as Partial<AIConfig>;
    return { ...DEFAULTS, ...stored, features: { ...DEFAULTS.features, ...(stored.features ?? {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}
