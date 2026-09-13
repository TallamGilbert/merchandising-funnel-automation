#!/bin/bash
# Runs once, automatically, on first start of the postgres container (empty
# data dir) via docker-entrypoint-initdb.d. Creates one dedicated login role
# and one database per service, and revokes default PUBLIC connect access so
# a service's role can reach ONLY its own database.
#
# This is what makes "database isolation" (NFR-1) an enforced Postgres
# permission rather than an honor-system convention: even though all 8
# databases live in one container for local-dev convenience, no service's
# credentials can open a connection to another service's database.
set -euo pipefail

create_service_db() {
	local db="$1"
	local role="$2"
	local password="$3"

	psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" <<-EOSQL
		CREATE ROLE ${role} WITH LOGIN PASSWORD '${password}';
		CREATE DATABASE ${db} OWNER ${role};
		REVOKE ALL PRIVILEGES ON DATABASE ${db} FROM PUBLIC;
		GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${role};
		ALTER DATABASE ${db} OWNER TO ${role};
	EOSQL
}

create_service_db "vendor_management"      "vendor_management_svc"      "${VENDOR_MANAGEMENT_DB_PASSWORD}"
create_service_db "procurement"            "procurement_svc"            "${PROCUREMENT_DB_PASSWORD}"
create_service_db "inventory"              "inventory_svc"              "${INVENTORY_DB_PASSWORD}"
create_service_db "receiving"              "receiving_svc"              "${RECEIVING_DB_PASSWORD}"
create_service_db "warehouse_operations"   "warehouse_operations_svc"   "${WAREHOUSE_OPERATIONS_DB_PASSWORD}"
create_service_db "retail_sales"           "retail_sales_svc"           "${RETAIL_SALES_DB_PASSWORD}"
create_service_db "sales_audit"            "sales_audit_svc"            "${SALES_AUDIT_DB_PASSWORD}"
create_service_db "financials"             "financials_svc"             "${FINANCIALS_DB_PASSWORD}"

echo "init-databases.sh: created 8 isolated service roles/databases."
