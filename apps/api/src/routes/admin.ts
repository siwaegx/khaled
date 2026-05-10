import { Router } from "express";

export const adminRouter = Router();

// /api/admin has been superseded by /api/sadmin (platform admin) and /api/organizations (tenant manager).
// This router returns 410 Gone on all paths to catch stale calls.
adminRouter.all("/*splat", (_req, res) => {
  res.status(410).json({
    error: "This endpoint has been removed.",
    platform: "Use /api/sadmin — requires isSaasAdmin access.",
    tenant: "Use /api/organizations for company-level management.",
  });
});
