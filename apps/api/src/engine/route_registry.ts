import type { Express, Router } from "express";
import path from "path";
import fs from "fs";
import { getManifest } from "@business360/engine";
import { requireAuth } from "../middleware/requireAuth";
import { resolveTenant } from "../middleware/tenantResolver";
import { requireModule } from "../middleware/requireModule";
import { attachHookService } from "../middleware/hookMiddleware";
import { attachOrgCurrency } from "../middleware/orgCurrency";

// Root-level /modules/ directory — matches where registerModules.ts loads from
const MODULES_DIR = path.resolve(__dirname, "../../../../modules");

// In-process cache: once a router is loaded it stays for the lifetime of the server.
// New modules are loaded on first request; deleted modules are blocked by requireModule
// (manifest gone → getManifest returns undefined → 403/404).
const routerCache = new Map<string, Router>();

function loadRouter(moduleKey: string): Router | null {
  if (routerCache.has(moduleKey)) return routerCache.get(moduleKey)!;

  const base = path.join(MODULES_DIR, moduleKey, "backend", "router");
  const filePath = fs.existsSync(`${base}.ts`)
    ? `${base}.ts`
    : fs.existsSync(`${base}.js`)
    ? `${base}.js`
    : null;

  if (!filePath) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(filePath) as { router: Router };
    routerCache.set(moduleKey, mod.router);
    console.log(`  ✓ Module router loaded on demand: ${moduleKey}`);
    return mod.router;
  } catch (err) {
    console.error(`  ✗ Failed to load module router "${moduleKey}":`, err);
    return null;
  }
}

/**
 * Attach a single dynamic wildcard middleware that dispatches to module routers.
 * Each module's router is loaded on first request and cached for the server lifetime.
 * Adding a new /modules/<key>/ folder is reflected immediately (next request auto-loads it)
 * as long as bootstrapModules() has been called to register the manifest.
 */
export function attachDynamicModuleRoutes(app: Express): void {
  app.use(
    "/api/:moduleKey",
    requireAuth,
    resolveTenant,
    attachOrgCurrency,
    attachHookService,
    (req, res, next) => requireModule(req.params["moduleKey"]!)(req, res, next),
    (req, res, next) => {
      const moduleKey = req.params["moduleKey"]!;

      // Guard: manifest must exist in the live registry
      if (!getManifest(moduleKey)) return next();

      const router = loadRouter(moduleKey);
      if (!router) return next();
      router(req, res, next);
    }
  );
}

// Backward-compatible alias used by index.ts
export { attachDynamicModuleRoutes as registerModuleRoutes };
