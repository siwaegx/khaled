# Business360 — Cloudflare Deployment Guide

## Architecture

| Layer | Technology | Cloudflare service |
|---|---|---|
| Frontend (Next.js 16) | Cloudflare Pages | Edge CDN, globally distributed |
| Backend (Express API) | Docker on any VPS | Cloudflare Tunnel (no open ports) |
| Database | PostgreSQL 16 | Stays inside Docker on the VPS |

---

## Prerequisites

- **Cloudflare account** with a domain added
- **Node.js 20** and **npm** (for building the web app)
- **Docker + Docker Compose** (on the VPS hosting the API)
- **wrangler CLI** — installed automatically when you run `npm install` in `apps/web`
- **cloudflared** — download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

---

## Part 1 — Deploy the Frontend to Cloudflare Pages

### Option A: Via the Cloudflare Dashboard (recommended for first deploy)

1. Go to **Cloudflare Pages → Create a project → Connect to Git**
2. Select your repository
3. Set the build configuration:
   - **Framework preset:** None
   - **Build command:** `npm install && npm run build:cf --workspace=web`
   - **Build output directory:** `apps/web/.vercel/output/static`
   - **Root directory:** `/` (repo root)
4. Add environment variables (see `.env.production.example` for the full list):
   - `NEXT_PUBLIC_API_URL` = `https://api.YOUR_DOMAIN.com`
5. Deploy — Cloudflare will assign a `*.pages.dev` URL immediately

### Option B: CLI (CI/CD or manual)

```bash
# From repo root
cd apps/web
npm install
./deploy/scripts/deploy-web.sh
```

This runs `next build && @cloudflare/next-on-pages` then deploys via `wrangler`.

### Custom domain for the web app

In the Cloudflare Pages dashboard → **Custom domains** → add `app.YOUR_DOMAIN.com`.

---

## Part 2 — Deploy the API (Docker + Cloudflare Tunnel)

### Step 1: Prepare environment variables

```bash
cp deploy/.env.production.example deploy/.env.production
# Edit deploy/.env.production — fill in ALL values
```

Key values to set:
- `POSTGRES_PASSWORD` — strong random password
- `JWT_SECRET` — at least 64 random hex chars (`openssl rand -hex 64`)
- `WEB_URL` / `FRONTEND_URL` — your Pages URL
- Stripe / Resend keys (if used)

### Step 2: Set up the Cloudflare Tunnel (first time only)

Run this **on the VPS** where Docker will run:

```bash
bash deploy/scripts/setup-cloudflare-tunnel.sh
```

Then edit `deploy/cloudflare/tunnel/config.yml`:
- Replace `YOUR_DOMAIN` with your actual domain
- The tunnel ID is already filled in by the script

Add a DNS record:
```bash
cloudflared tunnel route dns business360-api api.YOUR_DOMAIN.com
```

### Step 3: Start the API stack

```bash
bash deploy/scripts/deploy-api.sh
```

This starts four Docker services:
- `api` — the Express.js application on port 4000
- `postgres` — PostgreSQL 16
- `redis` — Redis 7
- `cloudflared` — Cloudflare Tunnel daemon (no ports opened to the internet)

### Step 4: Run Prisma migrations

```bash
docker compose -f deploy/docker/docker-compose.prod.yml exec api \
  npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

---

## Updating

### Frontend

Push to your connected git branch — Cloudflare Pages rebuilds automatically.

Or manually: `bash deploy/scripts/deploy-web.sh`

### Backend

```bash
git pull
bash deploy/scripts/deploy-api.sh   # rebuilds and restarts changed containers
```

---

## Folder structure

```
deploy/
├── .env.production.example       ← copy to .env.production and fill in
├── cloudflare/
│   ├── pages/
│   │   └── _headers              ← security headers for Cloudflare Pages
│   └── tunnel/
│       └── config.yml            ← Cloudflare Tunnel config (edit YOUR_TUNNEL_ID / YOUR_DOMAIN)
├── docker/
│   ├── Dockerfile.api            ← multi-stage production image for Express API
│   └── docker-compose.prod.yml   ← API + PostgreSQL + Redis + cloudflared
└── scripts/
    ├── setup-cloudflare-tunnel.sh ← run once on VPS to create the tunnel
    ├── deploy-web.sh              ← build + deploy frontend to Cloudflare Pages
    └── deploy-api.sh             ← build + start API Docker stack
```

`apps/web/wrangler.toml` — Cloudflare Pages project config (already committed).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Pages build fails | Check `NEXT_PUBLIC_*` env vars are set in the Pages dashboard |
| API returns 502 | `docker compose logs api` — check for missing env vars |
| Tunnel not connecting | `docker compose logs cloudflared` — verify credentials JSON is mounted |
| DB connection refused | Wait for `postgres` healthcheck to pass (`docker compose ps`) |
| Prisma migration error | Run migration step manually (see Step 4 above) |
