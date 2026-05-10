import fs from "fs";
import path from "path";
import { register, clearRegistry } from "@business360/engine";
import type { ModuleManifest } from "@business360/engine";

// Root-level /modules/ directory — one subfolder per module
const MODULES_DIR = path.resolve(__dirname, "../../../../modules");

export function bootstrapModules(): void {
  clearRegistry();

  if (!fs.existsSync(MODULES_DIR)) {
    console.warn("  ⚠ /modules directory not found — no modules loaded");
    return;
  }

  const entries = fs.readdirSync(MODULES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(MODULES_DIR, entry.name, "manifest.json");
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const raw      = fs.readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(raw) as ModuleManifest;
      register(manifest);
      console.log(`  ✓ Module registered: ${manifest.name} (${manifest.key})`);
    } catch (err) {
      console.error(`  ✗ Failed to load module "${entry.name}":`, err);
    }
  }
}
