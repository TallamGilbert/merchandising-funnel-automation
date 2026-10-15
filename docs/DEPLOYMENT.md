# Deploying to production

```
 browser ──► mms-pos.reduzer.co.ke, mms-finance…   Cloudflare Workers (9 Next.js apps, OpenNext)
    │
    └─────► mms-sales-api.reduzer.co.ke, …
                 │  Cloudflare edge (TLS)
                 ▼
            Cloudflare Tunnel ──(outbound only)── VPS: cloudflared ─► 9 NestJS services
                                                       Postgres · RabbitMQ (internal only)
```

- **Frontends** run on Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare),
  one Worker per app, each on its own custom domain. Backend URLs are baked in
  at build time by [`deploy/frontend-env.sh`](../deploy/frontend-env.sh).
- **Backend** is the existing `docker-compose.yml` plus
  [`docker-compose.prod.yml`](../docker-compose.prod.yml), which publishes **no
  ports** — traffic arrives only through the tunnel. Only SSH needs to be open.
- **Every hostname** is defined once in [`deploy/hosts.sh`](../deploy/hosts.sh)
  from `DOMAIN` and an optional `HOST_PREFIX`.

### Hostnames: `DOMAIN=reduzer.co.ke`, `HOST_PREFIX=mms-`

The system shares the `reduzer.co.ke` zone with other sites, so every app and
API gets an `mms-` name directly under it (`mms-pos.reduzer.co.ke`), not a
deeper subdomain (`pos.mms.reduzer.co.ke`). Cloudflare's free Universal SSL
certificate covers only one level below the zone. Two levels would fail HTTPS
on the API hostnames unless you pay for Advanced Certificate Manager.

None of these names may already have a DNS record: the tunnel setup overwrites
`mms-*-api` records, and Workers custom domains refuse a name that is taken.

| App | URL | API it calls |
|---|---|---|
| Vendor Management Portal | `mms-vendors.reduzer.co.ke` | `mms-vendors-api.reduzer.co.ke` |
| Procurement Dashboard | `mms-procurement.reduzer.co.ke` | `mms-procurement-api.reduzer.co.ke` |
| Inventory Control Center | `mms-inventory.reduzer.co.ke` | `mms-inventory-api.reduzer.co.ke` |
| Warehouse Receiving App | `mms-receiving.reduzer.co.ke` | `mms-receiving-api.reduzer.co.ke` |
| Warehouse Floor App | `mms-warehouse.reduzer.co.ke` | `mms-warehouse-api.reduzer.co.ke` |
| POS Terminal App | `mms-pos.reduzer.co.ke` | `mms-sales-api.reduzer.co.ke` |
| Store Manager Dashboard | `mms-stores.reduzer.co.ke` | `mms-audit-api.reduzer.co.ke` |
| Finance Portal | `mms-finance.reduzer.co.ke` | `mms-finance-api.reduzer.co.ke` |
| Executive Dashboard | `mms-dashboard.reduzer.co.ke` | all of them |
| (pickers, every app) | — | `mms-directory-api.reduzer.co.ke` |

After setup, **every push to `main` that passes CI deploys automatically**
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)): backend
first, then all 9 frontends in parallel. You can also run it by hand from the
Actions tab ("Deploy" → Run workflow).

## One-time setup

### 1. VPS

Needs Docker with Compose **≥ 2.24** (`docker compose version`) and `rsync`,
and **at least 4 GB of RAM** (or 2 GB plus swap): the VPS builds all 9 service
images itself and then runs 9 Node processes next to Postgres and RabbitMQ.

```bash
# on the VPS, as a sudo user
sudo apt-get install -y rsync
sudo useradd -m -s /bin/bash -G docker deploy        # skip if you have a user already
sudo install -d -o deploy -g deploy /opt/mms
```

Firewall: only SSH needs to be reachable. Nothing else is published on the host.

### 2. Deploy SSH key for GitHub Actions

On your machine:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/mms_deploy -C "github-actions-deploy"
ssh-copy-id -i ~/.ssh/mms_deploy.pub deploy@<VPS_IP>
ssh-keyscan -H <VPS_IP>        # output goes in the VPS_KNOWN_HOSTS secret
```

### 3. First copy of the code + production secrets

From the repo root on your machine:

```bash
rsync -az --exclude node_modules --exclude .git --exclude frontends --exclude '.env' \
  ./ deploy@<VPS_IP>:/opt/mms/
```

Then on the VPS:

```bash
cd /opt/mms
cp .env.production.example .env && chmod 600 .env
# replace every CHANGE_ME with:  openssl rand -hex 24
# CORS_ORIGINS / COOKIE_DOMAIN are already set for mms-*.reduzer.co.ke;
# pick BOOTSTRAP_OWNER_ID, and set DIRECTORY_SEED_DEMO=false for real data
nano .env
```

`deploy/vps/deploy.sh` refuses to run while any `CHANGE_ME` is left.

> The DB passwords are applied only when the Postgres volume is first
> created. Set them **before** the first deploy.

### 4. Cloudflare Tunnel (on the VPS)

```bash
cd /opt/mms
DOMAIN=reduzer.co.ke HOST_PREFIX=mms- bash deploy/vps/setup-tunnel.sh
```

It prints a login URL. Open it in any browser and pick `reduzer.co.ke`. The script
then creates the `mms` tunnel, adds a DNS record for each `*-api` hostname, and
writes `deploy/cloudflared/config.yml`. The credentials stay in
`deploy/cloudflared/`, which is gitignored and never overwritten by deploys.

### 5. First backend start (on the VPS)

```bash
cd /opt/mms && bash deploy/vps/deploy.sh
curl https://mms-directory-api.reduzer.co.ke/health      # from anywhere → 200
curl https://mms-procurement-api.reduzer.co.ke/purchase-orders   # → 401 without a session
```

Then open any app (e.g. `https://mms-dashboard.reduzer.co.ke`) and sign in as
`BOOTSTRAP_OWNER_ID` with `BOOTSTRAP_OWNER_PASSWORD`. You'll be asked to choose
a new password; after that, add your staff on the Store Manager Dashboard's
Staff page (each new person gets a one-time temporary password to hand over).

The first build compiles 9 images and takes a while. Later deploys reuse the layer cache.

### 6. Cloudflare API token

Cloudflare dashboard → My Profile → API Tokens → **Create Token** → the
"Edit Cloudflare Workers" template. Under Zone Resources, pick `reduzer.co.ke`, then
add **Zone → DNS → Edit** (custom domains create DNS records). Copy the
**Account ID** from the dashboard sidebar too.

### 7. GitHub repo settings

Settings → Environments → **New environment** `production`, then add:

| Kind | Name | Value |
|---|---|---|
| Variable | `DOMAIN` | `reduzer.co.ke` |
| Variable | `HOST_PREFIX` | `mms-` |
| Variable | `VPS_APP_DIR` | `/opt/mms` (optional, this is the default) |
| Variable | `VPS_SSH_PORT` | only if SSH isn't on 22 |
| Secret | `VPS_HOST` | VPS IP or hostname |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | contents of `~/.ssh/mms_deploy` (private key) |
| Secret | `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -H <VPS_IP>` |
| Secret | `CLOUDFLARE_API_TOKEN` | token from step 6 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | account ID from step 6 |

Then Actions → **Deploy** → Run workflow. When it's green, open `https://mms-dashboard.reduzer.co.ke`.

## Day to day

```bash
# on the VPS, from /opt/mms
alias dc='docker compose -f docker-compose.yml -f docker-compose.prod.yml'
dc ps                          # status
dc logs -f --tail 100 procurement
dc restart financials

# RabbitMQ management UI (from your machine)
ssh -L 15672:127.0.0.1:15672 deploy@<VPS_IP>    # then http://localhost:15672

# Backup all databases
dc exec -T postgres pg_dumpall -U mms_root | gzip > ~/mms-$(date +%F).sql.gz
```

Deploy a single frontend by hand (needs `wrangler login` or `CLOUDFLARE_API_TOKEN`):

```bash
DOMAIN=reduzer.co.ke HOST_PREFIX=mms- bash deploy/frontend-env.sh
cd frontends/pos-terminal-app
pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare deploy --domain mms-pos.reduzer.co.ke
```

Roll back a frontend: `cd frontends/<app> && pnpm exec wrangler rollback`.

## Known gaps before real production use

- **Staff see every store's data.** Permissions depend on role only (D-17);
  limiting cashiers and managers to their own store is not built yet.
- **Changing `AUTH_JWT_SECRET` signs everyone out**, and every service must get
  the same value (they all read the one `.env`).
- **Schema changes use `prisma db push`** (no committed migrations yet). In
  production the `--accept-data-loss` flag is removed, so a change that would
  drop data makes the service fail to start instead of losing the data. Move to
  `prisma migrate deploy` once the schemas settle.
- **`DIRECTORY_SEED_DEMO=true`** seeds demo stores and staff. Set it to `false` for real data.
- **The session cookie is scoped to `.reduzer.co.ke`**, because every `mms-*`
  app and API must share it. It is httpOnly, so other sites on the domain
  can't read it in the browser, but browsers send it to them. Don't run
  untrusted code on any `reduzer.co.ke` hostname.
- **Backups are manual** (the `pg_dumpall` line above). Put it in a nightly
  cron job, copied off the VPS, before real data goes in.
