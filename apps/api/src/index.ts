// Load env BEFORE any module-level code reads process.env
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { bootstrapModules } from "./bootstrap/registerModules";
import { authRouter } from "./routes/auth";
import { orgRouter } from "./routes/organizations";
import { modulesRouter } from "./routes/modules";
import { storeRouter } from "./routes/store";
import { adminRouter } from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";
import { prisma } from "./lib/prisma";
import { disconnectAll } from "./lib/tenantDb";
import { registerModuleRoutes } from "./engine/route_registry";

// Fail loudly at startup if JWT_SECRET is unset in production
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is not set");
  process.exit(1);
}

if (process.env.NODE_ENV !== "production" && !process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET not set — using insecure default. Set JWT_SECRET in .env");
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
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Global rate limit: 300 req/min per IP
app.use(rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
}));

// Stricter limit on auth endpoints: 20 req/15min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "business360-api", version: "4.0" });
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/organizations", orgRouter);
app.use("/api/modules", modulesRouter);
app.use("/api/store", storeRouter);
app.use("/api/admin", adminRouter);

// Mount dynamic backend routes for each module that has a router file
registerModuleRoutes(app);

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Business360 API running on http://localhost:${PORT}`);
});

async function shutdown() {
  server.close();
  await Promise.all([prisma.$disconnect(), disconnectAll()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
