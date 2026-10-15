# shellcheck shell=bash
# Single source of truth for production hostnames. Sourced by the tunnel
# setup (VPS), the frontend env generator (CI) and the frontend deploy (CI).
#
# Every name is ONE level below $DOMAIN (e.g. inventory-api.example.com, not
# api.inventory.example.com) so Cloudflare's free Universal SSL cert covers it.
# To share the zone with other sites, put the apps under a name prefix instead
# of a deeper subdomain: HOST_PREFIX=mms- gives mms-pos.example.com and
# mms-sales-api.example.com.
: "${DOMAIN:?DOMAIN must be set, e.g. DOMAIN=example.com}"
HOST_PREFIX="${HOST_PREFIX:-}"

# Backend service -> "<public hostname> <compose service>:<port>"
declare -A API_HOST=(
  [vendor-management]="${HOST_PREFIX}vendors-api.${DOMAIN}"
  [procurement]="${HOST_PREFIX}procurement-api.${DOMAIN}"
  [inventory]="${HOST_PREFIX}inventory-api.${DOMAIN}"
  [receiving]="${HOST_PREFIX}receiving-api.${DOMAIN}"
  [warehouse-operations]="${HOST_PREFIX}warehouse-api.${DOMAIN}"
  [retail-sales]="${HOST_PREFIX}sales-api.${DOMAIN}"
  [sales-audit]="${HOST_PREFIX}audit-api.${DOMAIN}"
  [financials]="${HOST_PREFIX}finance-api.${DOMAIN}"
  [directory]="${HOST_PREFIX}directory-api.${DOMAIN}"
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
  [vendor-management-portal]="${HOST_PREFIX}vendors.${DOMAIN}"
  [procurement-dashboard]="${HOST_PREFIX}procurement.${DOMAIN}"
  [inventory-control-center]="${HOST_PREFIX}inventory.${DOMAIN}"
  [warehouse-receiving-app]="${HOST_PREFIX}receiving.${DOMAIN}"
  [warehouse-floor-app]="${HOST_PREFIX}warehouse.${DOMAIN}"
  [pos-terminal-app]="${HOST_PREFIX}pos.${DOMAIN}"
  [store-manager-dashboard]="${HOST_PREFIX}stores.${DOMAIN}"
  [finance-portal]="${HOST_PREFIX}finance.${DOMAIN}"
  [executive-dashboard]="${HOST_PREFIX}dashboard.${DOMAIN}"
)

api_url() { echo "https://${API_HOST[$1]}"; }
app_url() { echo "https://${APP_HOST[$1]}"; }
