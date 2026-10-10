#!/usr/bin/env bash
# Runs ON the VPS from the app directory, after CI has rsynced the repo there
# (see .github/workflows/deploy.yml). Rebuilds and restarts the backend stack.
set -euo pipefail
cd "$(dirname "$0")/../.."

[ -f .env ] || { echo ".env missing — copy .env.production.example to .env and fill it in"; exit 1; }
if grep -q "CHANGE_ME" .env; then echo ".env still has CHANGE_ME values — fill them in"; exit 1; fi
[ -f deploy/cloudflared/config.yml ] || { echo "Tunnel not set up — run deploy/vps/setup-tunnel.sh once"; exit 1; }

compose() { docker compose -f docker-compose.yml -f docker-compose.prod.yml "$@"; }

compose build
compose up -d --remove-orphans

# Wait for every service's /health from inside the compose network.
for entry in vendor-management:3001 procurement:3002 inventory:3003 receiving:3004 \
  warehouse-operations:3005 retail-sales:3006 sales-audit:3007 financials:3008 directory:3009; do
  svc=${entry%:*} port=${entry#*:}
  for _ in $(seq 1 30); do
    if compose exec -T "$svc" node -e "fetch('http://localhost:${port}/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"; then
      echo "ok   $svc"; continue 2
    fi
    sleep 4
  done
  echo "FAIL $svc — last logs:"; compose logs --tail 40 "$svc"; exit 1
done

docker image prune -f >/dev/null
