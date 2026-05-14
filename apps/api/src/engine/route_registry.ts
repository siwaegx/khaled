import type { Express, Router, Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { getManifest } from "@business360/engine";
import { requireAuth } from "../middleware/requireAuth";
import { requireApiKey } from "../middleware/requireApiKey";
import { resolveTenant } from "../middleware/tenantResolver";
import { requireModule } from "../middleware/requireModule";
import { attachHookService } from "../middleware/hookMiddleware";
import { attachOrgCurrency } from "../middleware/orgCurrency";

// Accept either cookie JWT or Bearer API key
function requireAuthOrApiKey(req: Request, res: Response, next: NextFunction): void {
  if (req.headers["authorization"]?.startsWith("Bearer b360_")) {
    requireApiKey(req, res, next);
  } else {
    requireAuth(req, res, next);
  }
}

// Root-level /modules/ directory — matches where registerModules.ts loads from
const MODULES_DIR = path.resolve(__dirname, "../../../../modules");

// In-process cache: once a router is loaded it stays for the lifetime of the server.
// New modules are loaded on first request; deleted modules are blocked by requireModule
// (manifest gone → getManifest returns undefined → 403/404).
const routerCache = new Map<string, Router>();

function loadRouter(moduleKey: string): Router | null {
  if (routerCache.has(moduleKey)) return routerCache.get(moduleKey)!;

  // path.resolve normalises any ".." sequences — guard ensures we stay inside MODULES_DIR
  const base = path.resolve(MODULES_DIR, moduleKey, "backend", "router");
  if (!base.startsWith(MODULES_DIR + path.sep)) {
    console.error(`  ✗ Module router path traversal attempt blocked: "${moduleKey}"`);
    return null;
  }
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
    requireAuthOrApiKey,
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
