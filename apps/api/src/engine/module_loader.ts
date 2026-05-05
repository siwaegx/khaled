import fs from "fs";
import path from "path";
import type { ModuleManifest } from "./types";

const MODULES_DIR = path.resolve(__dirname, "../modules");
const cache = new Map<string, ModuleManifest>();

export function loadAllManifests(): ModuleManifest[] {
  if (cache.size > 0) return [...cache.values()];

  if (!fs.existsSync(MODULES_DIR)) return [];

  const entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(MODULES_DIR, entry.name, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ModuleManifest;
      cache.set(manifest.key, manifest);
    } catch {
      // skip malformed manifests
    }
  }

  return [...cache.values()];
}

export function getManifest(key: string): ModuleManifest | undefined {
  if (cache.size === 0) loadAllManifests();
  return cache.get(key);
}

export function clearManifestCache(): void {
  cache.clear();
}
