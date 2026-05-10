#!/usr/bin/env bash
# Deploy Business360 frontend to Cloudflare Pages
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WEB="$ROOT/apps/web"

echo "==> Building Business360 Web for Cloudflare Pages..."
cd "$WEB"
npm run build:cf

echo "==> Deploying to Cloudflare Pages..."
wrangler pages deploy .vercel/output/static \
  --project-name=business360-web \
  --branch=production

echo "==> Done! Your site is live on Cloudflare Pages."
