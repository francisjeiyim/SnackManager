# Deploy — test subdomain (client/server, Cloudflare Tunnel)

Puts SnackManager online at **one HTTPS hostname** (default
`https://snack.ciskolabtech.net`) in full client/server mode: PostgreSQL + the
NestJS API + the PWA, all behind a dedicated Cloudflare Tunnel. Same pattern as
the `hanabusa-transport` / `kanso-commerce` projects on this machine.

```
browser ──WSS/HTTPS──▶ Cloudflare edge ──tunnel──▶ web (nginx) ──▶ static SPA
                                                          └──/api, /socket.io──▶ server (:4100) ──▶ postgres
```

Files: [`docker-compose.prod.yml`](../docker-compose.prod.yml),
[`packages/server/Dockerfile`](../packages/server/Dockerfile),
[`packages/app/Dockerfile`](../packages/app/Dockerfile),
[`deploy/nginx.conf`](../deploy/nginx.conf),
[`.env.prod.example`](../.env.prod.example).

## 1. Create the tunnel (once)

Uses the existing `~/.cloudflared/cert.pem`. Run in a terminal:

```bash
cloudflared tunnel create snackmanager
cloudflared tunnel route dns snackmanager snack.ciskolabtech.net
```

`tunnel create` prints a **UUID** and writes `~/.cloudflared/<UUID>.json`. Note
both.

## 2. Fill `.env.prod`

```bash
cp .env.prod.example .env.prod
```

Then set:

| Key | Value |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://snack.ciskolabtech.net` (must equal the DNS route) |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` |
| `SEED_ADMIN_PASSWORD` | a strong password — the URL is public |
| `CLOUDFLARE_TUNNEL_ID` | the UUID from step 1 |
| `CLOUDFLARED_CREDENTIALS_PATH` | `C:/Users/francis/.cloudflared/<UUID>.json` |

## 3. Build & start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

The `server` container runs `prisma migrate deploy` then `prisma db seed`
(idempotent) on every start, so the DB is created and the admin account
asserted automatically.

Watch it come up:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f server tunnel
```

`tunnel` should log `Registered tunnel connection`. `server` should reach
`healthy`.

## 4. Verify

```bash
curl -s https://snack.ciskolabtech.net/api/health      # {"status":"ok","db":"up",...}
```

Open `https://snack.ciskolabtech.net`, log in as `admin` / `SEED_ADMIN_PASSWORD`.
Open a second tab, seat a guest in one — the other updates live (Socket.IO over
the tunnel). "Install app" works (HTTPS satisfied by the tunnel).

## Operating

| Task | Command (add `-f docker-compose.prod.yml --env-file .env.prod`) |
| --- | --- |
| Update after a code change | `docker compose … up -d --build` |
| Restart the API | `docker compose … restart server` |
| Tail logs | `docker compose … logs -f server` |
| Stop (keep data) | `docker compose … down` |
| Postgres shell | `docker compose … exec postgres psql -U snackmanager` |

**Never** `docker compose … down -v` — the `-v` deletes the `sm_pgdata` volume
and wipes the database. To reset on purpose: `down -v` then `up -d --build`
(migrations + seed rebuild a fresh DB).

## Notes

- The dev stack (`docker-compose.yml`, `snackmanager-postgres` on host port
  `5434`) is a separate compose project and is untouched. The prod Postgres is
  **not** published on the host.
- `PUBLIC_ORIGIN` is baked into the SPA bundle at build time (`VITE_API_URL`).
  Changing the hostname means rebuilding `web` (`up -d --build`).
- To use a different subdomain: create/route the tunnel for it, set
  `PUBLIC_ORIGIN` accordingly, rebuild.
