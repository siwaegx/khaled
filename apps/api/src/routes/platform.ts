import { Router } from "express";
import { platformSettings } from "./sadmin";

export const platformRouter = Router();

// ── GET /api/platform/plans — public, no auth ─────────────────────────────────
// Returns full plan configuration for the public pricing page.
platformRouter.get("/plans", (_req, res) => {
  res.json({ plans: platformSettings.planConfigs });
});
