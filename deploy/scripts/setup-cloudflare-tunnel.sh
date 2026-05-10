#!/usr/bin/env bash
# First-time Cloudflare Tunnel setup for Business360 API
# Run this once on the server that will host the API.
set -e

TUNNEL_NAME="business360-api"
DEPLOY="$(cd "$(dirname "$0")/.." && pwd)"
TUNNEL_CONF="$DEPLOY/cloudflare/tunnel/config.yml"

command -v cloudflared >/dev/null 2>&1 || {
  echo "ERROR: cloudflared not found. Install from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
}

echo "==> Step 1: Authenticate with Cloudflare"
cloudflared tunnel login

echo "==> Step 2: Create tunnel '$TUNNEL_NAME'"
cloudflared tunnel create "$TUNNEL_NAME"

TUNNEL_ID=$(cloudflared tunnel list --output json | python3 -c \
  "import sys,json; t=[x for x in json.load(sys.stdin) if x['name']=='$TUNNEL_NAME']; print(t[0]['id'])")

echo "    Tunnel ID: $TUNNEL_ID"

echo "==> Step 3: Updating $TUNNEL_CONF with tunnel ID"
sed -i "s/YOUR_TUNNEL_ID/$TUNNEL_ID/g" "$TUNNEL_CONF"

echo ""
echo "==> Step 4: Add a DNS CNAME for your API hostname"
echo "    Run: cloudflared tunnel route dns $TUNNEL_NAME api.YOUR_DOMAIN.com"
echo "    Then update 'hostname' in $TUNNEL_CONF with your real domain."
echo ""
echo "==> Copy the tunnel credentials JSON from ~/.cloudflared/$TUNNEL_ID.json"
echo "    into the cloudflared-creds Docker volume (or mount it directly)."
echo ""
echo "Setup complete. Edit $TUNNEL_CONF, then run deploy-api.sh."
