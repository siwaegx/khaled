FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ── Dependencies ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/db/package*.json ./packages/db/
COPY packages/module-sdk/package*.json ./packages/module-sdk/
COPY packages/shared/package*.json ./packages/shared/
COPY engine/package*.json ./engine/
RUN npm ci --legacy-peer-deps --workspace=apps/api --include-workspace-root

# ── Builder ─────────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=apps/api

# ── Runner ──────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=builder /app/modules ./modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000
CMD ["node", "apps/api/dist/index.js"]
