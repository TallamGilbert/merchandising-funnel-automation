# Running all the frontends locally

Step-by-step process to get every built frontend up and talking to real backend
data. Follow this top to bottom on a clean checkout.

All **8** frontends have real UI.

| Frontend | Port | Backend it needs |
|---|---|---|
| Vendor Management Portal | 3101 | vendor-management (3001) |
| Procurement Dashboard | 3102 | procurement (3002), vendor-management (3001) |
| Inventory Control Center | 3103 | inventory (3003) |
| Warehouse Receiving App | 3104 | receiving (3004) |
| Warehouse Floor App | 3105 | warehouse-operations (3005) |
| POS Terminal App | 3106 | retail-sales (3006), inventory (3003, gRPC 5003) |
| Store Manager Dashboard | 3107 | sales-audit (3007), retail-sales (3006) |
| Finance Portal | 3108 | financials (3008) |

Every frontend also reads the **directory** service (3009) — staff, stores,
warehouses and registers — to fill its pickers, and some read other modules
for lookups (e.g. the POS shows stock from inventory, the vendor portal picks
SKUs from inventory and POs from procurement). Running all 8 backends is the
simplest way to get every picker populated.

Financials books the ledger from events, and calls procurement (PO costs) and
inventory (unit costs) to value them — if either is down it retries on its own.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Start Postgres + RabbitMQ

```bash
docker compose up -d postgres rabbitmq
```

If this fails with `address already in use` on port 5432, something else on
your machine (often a system-wide Postgres service) already owns that port.
Don't fight it — just give the container a different host port:

```bash
docker compose down
POSTGRES_PORT=5433 docker compose up -d postgres rabbitmq
```

Wait for Postgres to report healthy before continuing:

```bash
until docker inspect --format='{{.State.Health.Status}}' mms-postgres-1 | grep -q healthy; do sleep 2; done
```

**Already had a Postgres volume from before the directory service existed?**
The init script only runs on an empty volume, so create the directory's
role and database once:

```bash
docker compose exec -T postgres psql -U mms_root -d postgres <<'SQL'
CREATE ROLE directory_svc WITH LOGIN PASSWORD 'directory_dev_password';
CREATE DATABASE directory OWNER directory_svc;
REVOKE ALL PRIVILEGES ON DATABASE directory FROM PUBLIC;
GRANT ALL PRIVILEGES ON DATABASE directory TO directory_svc;
SQL
```

## 3. Set up each backend service's env file

For each of the 9 services, copy its local-dev env template and point
`DATABASE_URL` at whichever Postgres port you actually used in step 2 (5432,
or 5433 if you remapped it):

```bash
for svc in vendor-management procurement inventory receiving warehouse-operations retail-sales sales-audit financials directory; do
  cp "services/$svc/.env.example" "services/$svc/.env"
  # only needed if you remapped the port in step 2:
  sed -i 's/localhost:5432/localhost:5433/' "services/$svc/.env"
done
```

## 4. Generate Prisma clients and create the database tables

```bash
pnpm --filter @mms/shared run build

for svc in vendor-management procurement inventory receiving warehouse-operations retail-sales sales-audit financials directory; do
  pnpm --filter "@mms/${svc}" exec prisma generate
  pnpm --filter "@mms/${svc}" exec prisma db push --skip-generate --accept-data-loss
done
```

## 5. Start the 9 backend services

All nine in one terminal (output is prefixed per service; Ctrl+C stops all):

```bash
pnpm dev:services
```

Confirm they're all up before moving on:

```bash
for p in 3001 3002 3003 3004 3005 3006 3007 3008 3009; do
  curl -s -o /dev/null -w "port $p: %{http_code}\n" http://localhost:$p/health
done
```

You should see `200` for all nine. On first start the directory seeds demo
locations (WH-MAIN, DOCK-1, STORE-1, STORE-2), registers and staff; manage
them on the Store Manager Dashboard's **Staff** page. If one shows `000`, check that terminal's
output — it's usually a `Can't reach database server` race on first boot;
just re-run `pnpm --filter @mms/<svc> run dev` for that one service.

## 6. Set up each frontend's env file

```bash
for fe in vendor-management-portal procurement-dashboard inventory-control-center warehouse-receiving-app warehouse-floor-app pos-terminal-app store-manager-dashboard finance-portal; do
  cp "frontends/$fe/.env.example" "frontends/$fe/.env.local"
done
```

These already point at the right backend ports (3001–3009) out of the box —
no editing needed.

## 7. Start the 8 frontends

In a second terminal:

```bash
pnpm dev:frontends
```

## 8. Open them

- Vendor Management Portal — http://localhost:3101
- Procurement Dashboard — http://localhost:3102
- Inventory Control Center — http://localhost:3103
- Warehouse Receiving App — http://localhost:3104
- Warehouse Floor App — http://localhost:3105
- POS Terminal App — http://localhost:3106
- Store Manager Dashboard — http://localhost:3107
- Finance Portal — http://localhost:3108

On a fresh database every list will say "No X found" — that's expected, not a
bug. To see the full flow work end to end:

1. **Inventory Control Center** → New product (give it a SKU). Inventory owns
   the product master, so create it here first.
2. **Vendor Management Portal** → New supplier → open it → Add product → pick
   the product you just created from the list, set its cost and currency.
3. **Procurement Dashboard** → New purchase order → pick the supplier, the
   requester and the product → Create draft PO → open it → Submit for
   approval → Approve → pick the approver in the modal (their role comes
   from the directory; pick an **owner** if the total is above the approval
   limit) → Mark sent.
4. **Warehouse Receiving App** → the PO now appears under Expected deliveries
   → Receive → pick the warehouse and who is receiving → Start receiving →
   scan or pick the SKU with the full quantity → Finalize GRN.
5. **Warehouse Floor App** → Bins & capacity → New bin at the same warehouse
   → back to Putaway → choose who is working → Find a bin (or pick one from
   the drop-down) → confirm the bin → Confirm putaway.
6. **Inventory Control Center** → Stock levels — the received quantity shows
   up there, and keeps refreshing as the POS sells.
7. **Warehouse Floor App** → Transfers → New transfer from the warehouse to a
   store → open it → confirm every pick. Stock only moves to the store once
   the last pick is confirmed.
8. **POS Terminal App** → Price list → the product shows under "In stock at a
   store, but not priced" → Set price. The POS sells from Retail Sales' own
   price list, so a product needs a price here before the till can sell it.
9. **POS Terminal App** → Checkout → pick the store, register and cashier →
   search for the product → Complete sale.
10. **Store Manager Dashboard** → Close register → record the count, explain
    any discrepancy → Close store.
11. **Finance Portal** → Accounts payable shows the supplier bill from step 4
    (due after the PO's payment terms) → Record payment. Overview and
    Profitability show the sale's revenue and gross profit; General ledger
    shows every posting and a trial balance that balances.

Financials only sees events published while it's subscribed: its queues are
created the first time it starts, so activity from before that isn't booked.

## Troubleshooting

- **Docker daemon not running:** `sudo systemctl start docker` (needs a
  terminal you can type a password into — this can't be scripted headlessly).
- **`docker compose up` for the full stack (all 9 services) times out /
  fails to fetch packages:** that's building 9 Docker images from scratch,
  which needs a fast, unblocked connection to the npm registry. If your
  network is slow or restricted, skip Docker for the services entirely and
  run them with `pnpm dev` locally as in step 5 — only Postgres and RabbitMQ
  need to be in Docker.
- **A backend service can't reach Postgres right after `docker compose up`:**
  it started before Postgres finished its own init script. Just restart that
  one service.
