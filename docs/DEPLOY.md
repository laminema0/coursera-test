# Free Hosting (Oracle Cloud "Always Free")

The backend is one Node 22 process. State lives in a SQLite file (`data/news.db`, via Node's built-in `node:sqlite`:
no database server, no native module to compile), so a free, always-on VM is enough. Everything below is free:
Oracle Cloud Always Free VM + Cloudflare Tunnel for HTTPS.

Two ways to run it; pick one:
- **A. systemd** (plain Node on the VM): fewest moving parts.
- **B. Docker Compose**: API + optional `cloudflared` container, one command to update.

## 1. Create the VM (once)
1. Sign up at Oracle Cloud and choose a **home region** close to you (e.g. Frankfurt).
   A card is needed for identity checks; Always Free resources are not charged.
2. Create a compute instance: **Ubuntu 24.04**, shape **VM.Standard.A1.Flex** (Arm, Always Free) with 1 OCPU / 6 GB RAM.
3. Add your SSH key. Leave the rest as default.

## 2A. Install with systemd
Needs Node **22.18 or newer** (runs TypeScript directly and has `node:sqlite` without flags).
```bash
ssh ubuntu@<vm-ip>
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node --version                                # must be ≥ v22.18
sudo useradd --system --create-home --home-dir /opt/news-verify newsverify
sudo -u newsverify git clone -b ios-foundation https://github.com/laminema0/coursera-test /opt/news-verify
cd /opt/news-verify/backend
sudo -u newsverify npm ci --omit=dev
sudo -u newsverify cp .env.example .env      # defaults are fine; X stays off
sudo -u newsverify mkdir -p data
sudo -u newsverify npm run check-sources     # optional: see which feeds work from the VM
sudo cp deploy/news-verify.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now news-verify
curl localhost:8787/health && curl localhost:8787/ready
```
Update:
```bash
cd /opt/news-verify && sudo -u newsverify git pull && cd backend && sudo -u newsverify npm ci --omit=dev
sudo cp deploy/news-verify.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl restart news-verify
```

## 2B. Install with Docker Compose
```bash
ssh ubuntu@<vm-ip>
sudo apt-get install -y docker.io docker-compose-v2 git
sudo git clone -b ios-foundation https://github.com/laminema0/coursera-test /opt/news-verify
cd /opt/news-verify/backend
sudo cp .env.example .env                      # optional settings, see below
sudo docker compose up -d --build              # API on http://127.0.0.1:8787 (not exposed publicly)
curl localhost:8787/ready
```
The image is `node:22-alpine`, runs as the non-root `node` user with a read-only root filesystem, has a Docker
`HEALTHCHECK` on `/health`, and keeps state in the `news-data` volume (`/data/news.db`).
`docker compose stop` sends SIGTERM and waits up to 60 s, so a running cycle finishes and the database closes cleanly.

Update: `cd /opt/news-verify && sudo git pull && cd backend && sudo docker compose up -d --build`.

## 3. Make it reachable over HTTPS (Cloudflare Tunnel)
The iOS app needs HTTPS. Free option: **Cloudflare Tunnel**. No open ports, no certificate work, free.
Create a tunnel in the Cloudflare dashboard (Zero Trust → Networks → Tunnels) and copy its token.

- **systemd install:** run cloudflared on the host and route `https://api.<your-domain>` → `http://localhost:8787`.
  ```bash
  sudo cloudflared service install <token-from-dashboard>
  ```
- **Docker install:** let compose run cloudflared next to the API and route the hostname → `http://api:8787`.
  ```bash
  echo "TUNNEL_TOKEN=<token-from-dashboard>" | sudo tee -a .env
  sudo docker compose --profile tunnel up -d --build
  ```
  Compose sets `TRUST_PROXY=private` so per-client rate limiting uses Cloudflare's `CF-Connecting-IP`.

No domain yet? `cloudflared tunnel --url http://localhost:8787` gives a temporary `*.trycloudflare.com` URL for testing.

Then set `API_BASE_URL = https:/$()/api.<your-domain>/v1` and `USE_MOCK_DATA = NO` in `Configs/Staging.xcconfig`.

## 4. Operate
| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness: the process is up. Used by the Docker healthcheck. Never rate-limited. |
| `GET /ready` | Readiness: 200 once an analysis result is served (immediately after a restart if the database has articles), 503 before. |
| `GET /metrics` | Prometheus text format. Open to the host and private networks; requests through the tunnel need `Authorization: Bearer $METRICS_TOKEN`. |

Main metrics: `newsverify_cycle_duration_seconds`, `newsverify_cycles_total{result}`, `newsverify_articles`,
`newsverify_events{status}`, `newsverify_source_failures_total{source}`, `newsverify_sources_unhealthy`,
`newsverify_gdelt_requests_total{result}`, `newsverify_http_requests_total{route,method,status}`,
`newsverify_http_rate_limited_total`, `newsverify_storage_errors_total`.

**Logs** are JSON lines (`LOG_LEVEL=debug|info|warn|error`):
```bash
journalctl -u news-verify -f -o cat | jq -c 'select(.level != "debug")'     # systemd
sudo docker compose logs -f api | cut -d'|' -f2- | jq -c .                   # docker
```

**Reliability built in:** one failing or malformed feed only marks that source unhealthy (with backoff); a cycle that
runs past `CYCLE_TIMEOUT_SECONDS` skips its optional stages (GDELT, X), and one stuck for twice that exits the process
so systemd/Docker restarts it. Each cycle's state is written in one SQLite transaction, so a restart never sees half a cycle.

**API caching:** `/v1/events` sends a weak `ETag`; clients sending `If-None-Match` get `304 Not Modified`. Responses
over 1 KB are gzip-compressed when the client sends `Accept-Encoding: gzip` (URLSession does). The JSON shape is unchanged.

## 5. Settings (`.env`)
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8787 | HTTP port. |
| `DATA_DIR` | dir of `DATA_FILE` | Where `news.db` lives. Unset (and no `DATA_FILE`/`DB_FILE`) = memory only. |
| `DB_FILE` | `$DATA_DIR/news.db` | SQLite file path. |
| `DATA_FILE` | – | Old X snapshot; imported once together with `data/*.json`. |
| `LOG_LEVEL` | info | `debug`, `info`, `warn`, `error`. |
| `CYCLE_INTERVAL_SECONDS` | 60 | How often feeds are polled (each feed also has its own interval). |
| `CYCLE_TIMEOUT_SECONDS` | 300 | Cycle watchdog (see above). |
| `SHUTDOWN_TIMEOUT_SECONDS` | 45 | How long SIGTERM waits for a running cycle. Keep below systemd/compose stop timeout (60 s). |
| `ARTICLE_RETENTION_HOURS` | 72 | Articles older than this are dropped from memory and the database. |
| `GDELT` | on | `off` disables GDELT coverage lookups. |
| `RATE_LIMIT_PER_MINUTE` | 120 | Per-client API limit. |
| `CORS_ORIGINS` | (off) | Comma-separated origins, or `*`. Only needed for browser clients. |
| `TRUST_PROXY` | loopback | Trust `CF-Connecting-IP` from `loopback`, `private` networks, or `none`. |
| `METRICS_TOKEN` | – | Allows scraping `/metrics` through the tunnel. |
| `X_BEARER_TOKEN`, `DAILY_BUDGET_USD` | – | Optional paid X integration (off by default). |

## Notes
- **Migrating from JSON snapshots:** on the first start with this version, `data/articles.json`, `track-record.json`,
  `status-history.json` and the X snapshot (`DATA_FILE`) are imported into `news.db` and renamed to `*.migrated`.
  Delete those once you're happy. Corrupt files are skipped with a warning.
- **Backups:** `news.db` is the only state; losing it just means re-collecting the last 72 hours and the
  sources' track record starting over. Consistent copy while running:
  `node -e "new (require('node:sqlite').DatabaseSync)('data/news.db').exec(\"VACUUM INTO 'data/backup.db'\")"`.
- **Disk:** the database stays small (tens of MB): expired articles are deleted hourly and the WAL is checkpointed.
- **Idle reclaim:** Oracle may reclaim Always Free VMs that stay almost idle for 7 days. The collector runs every minute, which normally keeps it active.
- **Memory:** 72 hours of articles from 58 feeds uses well under 500 MB (the compose file caps the container at 768 MB).
- **Local end-to-end run without internet:** `npm run serve-fixtures -- 9900 /tmp/fixture-sources.json`, then
  `SOURCES_FILE=/tmp/fixture-sources.json GDELT=off DATA_DIR=/tmp/nv npm start`.
