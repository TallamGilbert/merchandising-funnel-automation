# shellcheck shell=bash
# Single source of truth for production hostnames. Sourced by the tunnel
# setup (VPS), the frontend env generator (CI) and the frontend deploy (CI).
#
# Every name is ONE level below $DOMAIN (e.g. inventory-api.example.com, not
# api.inventory.example.com) so Cloudflare's free Universal SSL cert covers it.
: "${DOMAIN:?DOMAIN must be set, e.g. DOMAIN=example.com}"

# Backend service -> "<public hostname> <compose service>:<port>"
declare -A API_HOST=(
  [vendor-management]="vendors-api.${DOMAIN}"
  [procurement]="procurement-api.${DOMAIN}"
  [inventory]="inventory-api.${DOMAIN}"
  [receiving]="receiving-api.${DOMAIN}"
  [warehouse-operations]="warehouse-api.${DOMAIN}"
  [retail-sales]="sales-api.${DOMAIN}"
  [sales-audit]="audit-api.${DOMAIN}"
  [financials]="finance-api.${DOMAIN}"
  [directory]="directory-api.${DOMAIN}"
)
declare -A API_PORT=(
  [vendor-management]=3001
  [procurement]=3002
  [inventory]=3003
  [receiving]=3004
  [warehouse-operations]=3005
  [retail-sales]=3006
  [sales-audit]=3007
  [financials]=3008
  [directory]=3009
)

# Frontend (frontends/<dir>) -> public hostname (a Worker custom domain)
declare -A APP_HOST=(
  [vendor-management-portal]="vendors.${DOMAIN}"
  [procurement-dashboard]="procurement.${DOMAIN}"
  [inventory-control-center]="inventory.${DOMAIN}"
  [warehouse-receiving-app]="receiving.${DOMAIN}"
  [warehouse-floor-app]="warehouse.${DOMAIN}"
  [pos-terminal-app]="pos.${DOMAIN}"
  [store-manager-dashboard]="stores.${DOMAIN}"
  [finance-portal]="finance.${DOMAIN}"
  [executive-dashboard]="dashboard.${DOMAIN}"
)

api_url() { echo "https://${API_HOST[$1]}"; }
app_url() { echo "https://${APP_HOST[$1]}"; }
