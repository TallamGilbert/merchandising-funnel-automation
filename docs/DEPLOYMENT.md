# Deploying to production

```
 browser ──► pos.$DOMAIN, finance.$DOMAIN, …      Cloudflare Workers (9 Next.js apps, OpenNext)
    │
    └─────► sales-api.$DOMAIN, finance-api.$DOMAIN, …
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
- **Every hostname** is defined once in [`deploy/hosts.sh`](../deploy/hosts.sh).

| App | URL | API it calls |
|---|---|---|
| Vendor Management Portal | `vendors.$DOMAIN` | `vendors-api.$DOMAIN` |
| Procurement Dashboard | `procurement.$DOMAIN` | `procurement-api.$DOMAIN` |
| Inventory Control Center | `inventory.$DOMAIN` | `inventory-api.$DOMAIN` |
| Warehouse Receiving App | `receiving.$DOMAIN` | `receiving-api.$DOMAIN` |
| Warehouse Floor App | `warehouse.$DOMAIN` | `warehouse-api.$DOMAIN` |
| POS Terminal App | `pos.$DOMAIN` | `sales-api.$DOMAIN` |
| Store Manager Dashboard | `stores.$DOMAIN` | `audit-api.$DOMAIN` |
| Finance Portal | `finance.$DOMAIN` | `finance-api.$DOMAIN` |
| Executive Dashboard | `dashboard.$DOMAIN` | all of them |
| (pickers, every app) | — | `directory-api.$DOMAIN` |

After setup, **every push to `main` that passes CI deploys automatically**
([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)): backend
first, then all 9 frontends in parallel. You can also run it by hand from the
Actions tab ("Deploy" → Run workflow).

## One-time setup

### 1. VPS

Needs Docker with Compose **≥ 2.24** (`docker compose version`) and `rsync`.

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
nano .env
```

> The DB passwords are applied only when the Postgres volume is first
> created. Set them **before** the first deploy.

### 4. Cloudflare Tunnel (on the VPS)

```bash
cd /opt/mms
DOMAIN=example.com bash deploy/vps/setup-tunnel.sh
```

It prints a login URL. Open it in any browser and pick your domain. The script
then creates the `mms` tunnel, adds a DNS record for each `*-api` hostname, and
writes `deploy/cloudflared/config.yml`. The credentials stay in
`deploy/cloudflared/`, which is gitignored and never overwritten by deploys.

### 5. First backend start (on the VPS)

```bash
cd /opt/mms && bash deploy/vps/deploy.sh
curl https://directory-api.example.com/health      # from anywhere → 200
```

The first build compiles 9 images and takes a while. Later deploys reuse the layer cache.

### 6. Cloudflare API token

Cloudflare dashboard → My Profile → API Tokens → **Create Token** → the
"Edit Cloudflare Workers" template. Under Zone Resources, pick your domain, then
add **Zone → DNS → Edit** (custom domains create DNS records). Copy the
**Account ID** from the dashboard sidebar too.

### 7. GitHub repo settings

Settings → Environments → **New environment** `production`, then add:

| Kind | Name | Value |
|---|---|---|
| Variable | `DOMAIN` | `example.com` |
| Variable | `VPS_APP_DIR` | `/opt/mms` (optional, this is the default) |
| Variable | `VPS_SSH_PORT` | only if SSH isn't on 22 |
| Secret | `VPS_HOST` | VPS IP or hostname |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | contents of `~/.ssh/mms_deploy` (private key) |
| Secret | `VPS_KNOWN_HOSTS` | output of `ssh-keyscan -H <VPS_IP>` |
| Secret | `CLOUDFLARE_API_TOKEN` | token from step 6 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | account ID from step 6 |

Then Actions → **Deploy** → Run workflow. When it's green, open `https://dashboard.$DOMAIN`.

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
DOMAIN=example.com bash deploy/frontend-env.sh
cd frontends/pos-terminal-app
pnpm exec opennextjs-cloudflare build && pnpm exec opennextjs-cloudflare deploy --domain pos.example.com
```

Roll back a frontend: `cd frontends/<app> && pnpm exec wrangler rollback`.

## Known gaps before real production use

- **The APIs have no authentication.** Anyone who finds `sales-api.$DOMAIN`
  can read and write data. Fine for a demo; not for a real business. The
  quickest stopgap is Cloudflare Access on the frontend and API hostnames.
- **CORS allows any origin** (`app.enableCors()` in each service). Once auth
  exists, restrict it to `https://*.$DOMAIN`.
- **Schema changes use `prisma db push`** (no committed migrations yet). In
  production the `--accept-data-loss` flag is removed, so a change that would
  drop data makes the service fail to start instead of losing the data. Move to
  `prisma migrate deploy` once the schemas settle.
- **`DIRECTORY_SEED_DEMO=true`** seeds demo stores and staff. Set it to `false` for real data.
