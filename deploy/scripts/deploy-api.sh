#!/usr/bin/env bash
# Deploy Business360 API + Cloudflare Tunnel via Docker Compose
set -e

DEPLOY="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$DEPLOY/.env.production" ]; then
  echo "ERROR: $DEPLOY/.env.production not found."
  echo "       Copy deploy/.env.production.example to deploy/.env.production and fill in the values."
  exit 1
fi

echo "==> Building and starting Business360 API stack..."
docker compose \
  -f "$DEPLOY/docker/docker-compose.prod.yml" \
  --env-file "$DEPLOY/.env.production" \
  up -d --build

echo ""
echo "==> Stack is up. Services:"
docker compose \
  -f "$DEPLOY/docker/docker-compose.prod.yml" \
  ps

echo ""
echo "==> API health check:"
sleep 5
curl -sf http://localhost:4000/health | python3 -m json.tool 2>/dev/null || \
  echo "  (health check not yet ready — try again in a few seconds)"
