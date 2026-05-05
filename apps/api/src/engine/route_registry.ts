import type { Express, Router } from "express";
import path from "path";
import fs from "fs";
import { getAllManifests } from "@business360/engine";
import { requireAuth } from "../middleware/requireAuth";
import { resolveTenant } from "../middleware/tenantResolver";
import { requireModule } from "../middleware/requireModule";

export function registerModuleRoutes(app: Express): void {
  const manifests = getAllManifests();

  for (const manifest of manifests) {
    const routerFile = path.resolve(
      __dirname,
      `../modules/${manifest.key}/backend/router`
    );
    const exists =
      fs.existsSync(`${routerFile}.ts`) || fs.existsSync(`${routerFile}.js`);
    if (!exists) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(routerFile) as { router: Router };
      app.use(
        `/api/${manifest.key}`,
        requireAuth,
        resolveTenant,
        requireModule(manifest.key),
        mod.router
      );
      console.log(`  ✓ Module routes registered: /${manifest.key}`);
    } catch (err) {
      console.error(`  ✗ Failed to register module "${manifest.key}":`, err);
    }
  }
}
