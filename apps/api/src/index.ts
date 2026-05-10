// Load env BEFORE any module-level code reads process.env
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { bootstrapModules } from "./bootstrap/registerModules";
import { authRouter } from "./routes/auth";
import { orgRouter } from "./routes/organizations";
import { modulesRouter } from "./routes/modules";
import { storeRouter } from "./routes/store";
import { adminRouter } from "./routes/admin";
import { sadminRouter } from "./routes/sadmin";
import { developerRouter } from "./routes/developer";
import { platformRouter } from "./routes/platform";
import { billingRouter } from "./routes/billing";
import { activityRouter } from "./routes/activity";
import { searchRouter } from "./routes/search";
import { apiKeysRouter } from "./routes/apiKeys";
import { invitesRouter } from "./routes/invites";
import { membersRouter } from "./routes/members";
import { teamsRouter } from "./routes/teams";
import { moduleAccessRouter } from "./routes/moduleAccess";
import { reportsRouter } from "./routes/reports";
import { notificationsRouter } from "./routes/notifications";
import { webhooksRouter } from "./routes/webhooks";
import { documentsRouter } from "./routes/documents";
import { dashboardConfigRouter } from "./routes/dashboardConfig";
import { configListsRouter } from "./routes/configLists";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./lib/openapi";
import { errorHandler } from "./middleware/errorHandler";
import { requireAuth } from "./middleware/requireAuth";
import { resolveTenant } from "./middleware/tenantResolver";
import { prisma } from "./lib/prisma";
import { disconnectAll } from "./lib/tenantDb";
import { registerModuleRoutes } from "./engine/route_registry";

// ── Startup environment validation ────────────────────────────────────────────
const REQUIRED_PROD_VARS = ["JWT_SECRET", "DATABASE_URL", "WEB_URL", "FRONTEND_URL"];
if (process.env.NODE_ENV === "production") {
  const missing = REQUIRED_PROD_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set — using insecure default 'secret'. Set JWT_SECRET in .env");
}
if (!process.env.DATABASE_URL) {
  console.warn("WARNING: DATABASE_URL not set — database connections will fail");
}
if (!process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_SECRET_KEY) {
  console.warn("WARNING: STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — Stripe webhooks will be rejected");
}

// Register all module manifests before routing
bootstrapModules();

const app = express();
const PORT = process.env.PORT ?? 4000;

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // API only, no HTML served
}));

const allowedOrigin = process.env.WEB_URL ?? "http://localhost:3000";
app.use(cors({ origin: allowedOrigin, credentials: true }));
// Raw body for Stripe webhook signature verification (must come before express.json)
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Serialize Prisma Decimal values as plain numbers in JSON responses.
// Required after Float → Decimal migration (DB-003).
app.use((_req, res, next) => {
  const origJson = res.json.bind(res);
  res.json = (body: unknown) => {
    return origJson(JSON.parse(JSON.stringify(body, (_key, val) => {
      // Prisma Decimal: has .toNumber() and its constructor name is "Decimal"
      if (val !== null && typeof val === "object" && typeof (val as { toNumber?: unknown }).toNumber === "function") {
        return (val as { toNumber: () => number }).toNumber();
      }
      return val;
    })));
  };
  next();
});

// Global rate limit: 300 req/min per IP
app.use(rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
}));

// Stricter limit on login/register: 50 req/15min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
  skip: () => process.env.NODE_ENV !== "production",
});

// HTTP request logging (skip health checks to reduce noise)
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/api/health" },
}));

const START_TIME = Date.now();

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "business360-api",
    version: "4.1",
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "business360-api",
    version: "4.1",
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Maintenance mode gate — bypasses sadmin and auth/login so operators can still recover
app.use((req, res, next) => {
  const { platformSettings } = require("./routes/sadmin") as { platformSettings: { maintenanceMode: boolean } };
  if (
    platformSettings.maintenanceMode &&
    !req.path.startsWith("/api/sadmin") &&
    !req.path.startsWith("/api/auth/login") &&
    !req.path.startsWith("/api/auth/logout") &&
    req.path !== "/health"
  ) {
    res.status(503).json({ error: "Platform is under maintenance. Please try again later." });
    return;
  }
  next();
});

// Apply strict limiter to auth mutation endpoints
app.use("/api/auth/login",           authLimiter);
app.use("/api/auth/register",        authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/reset-password",  authLimiter);
app.use("/api/auth", authRouter);
app.use("/api/organizations", orgRouter);
app.use("/api/modules", modulesRouter);
app.use("/api/store", storeRouter);
app.use("/api/sadmin", sadminRouter);
app.use("/api/platform", platformRouter);
app.use("/api/admin", adminRouter); // 410 stub — kept for backward-compat catch
app.use("/api/developer", developerRouter);
app.use("/api/billing", billingRouter);
app.use("/api/activity", requireAuth, resolveTenant, activityRouter);
app.use("/api/search", searchRouter);
app.use("/api/org/api-keys", apiKeysRouter);
app.use("/api/org/invites", invitesRouter);
app.use("/api/org/members", membersRouter);
app.use("/api/org/teams", teamsRouter);
app.use("/api/org/module-access", moduleAccessRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/dashboard", dashboardConfigRouter);
app.use("/api/org/config", configListsRouter);

// Mount dynamic backend routes for each module that has a router file
registerModuleRoutes(app);

// OpenAPI docs (non-production or explicitly enabled)
if (process.env.NODE_ENV !== "production" || process.env.ENABLE_DOCS === "true") {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, {
    customSiteTitle: "Business360 API Docs",
    customCss: ".swagger-ui .topbar { display: none }",
  }));
  app.get("/api/docs.json", (_req, res) => res.json(openapiSpec));
}

app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info(`Business360 API running on http://localhost:${PORT}`);
});

let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`Received ${signal} — starting graceful shutdown`);

  // Stop accepting new connections
  server.close(async () => {
    logger.info("HTTP server closed");
    try {
      await Promise.all([prisma.$disconnect(), disconnectAll()]);
      logger.info("Database connections closed");
    } catch (err) {
      logger.error({ err }, "Error closing DB connections");
    }
    process.exit(0);
  });

  // Force-exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error("Graceful shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
