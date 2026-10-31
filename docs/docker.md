# Docker deployment

> [简体中文](zh-CN/docker.md)

Docker is the recommended fast path and a complete production deployment option.
Native Node.js + systemd installs remain fully supported; see
[native deployment](deployment.md) when the app should run on the host.

The Compose stack ships a complete environment:

| Service | Role |
| --- | --- |
| `gateway` | Nginx on port 8080: serves `/admin/`, proxies `/api`, `/media`, `/socket.io`, and the web app |
| `web` | Next.js standalone server |
| `api` | NestJS API and installer |
| `worker` | FFmpeg transcoding, search indexing, recommendations, cleanup |
| `bootstrap` | One-shot installer/migrator, runs before the API starts |
| `postgres` | PostgreSQL 16 (application schema `uiliuili`) |
| `redis` | Optional in code, enabled here for cache and Socket.IO fan-out |

Uploads, HLS output, covers, `.env`, and `config/instance.json` live on the
`app-data` volume mounted at `/data`. PostgreSQL and Redis keep their own
volumes.

## Requirements

- Docker Engine with Compose v2
- 2 vCPU and 4 GB RAM to evaluate; more for transcoding (see
  [recommended hardware](deployment.md#recommended-hardware))
- 20 GB+ free disk for images and the first uploads
- An FFmpeg 7 runtime is included in the application image

## One-command install (recommended)

```bash
git clone https://github.com/uiliuili-project/uiliuili.git
cd uiliuili
./scripts/quickstart.sh
```

The script:

1. creates `.env` from `docker/.env.example` when it is missing;
2. generates `APP_KEY` (64 hex characters) and a URL-safe `DB_PASSWORD`;
3. runs `docker compose up -d --build`;
4. polls `http://127.0.0.1:8080/health` until it is healthy;
5. prints the site, admin, and health URLs plus the **owner claim token**.

Open the site, register the first account with the claim token, then sign in at
`/admin/`.

Options:

```bash
./scripts/quickstart.sh --port 9090   # change the public port and APP_URL
./scripts/quickstart.sh --no-build    # start existing images
ENV_FILE=/path/to/.env ./scripts/quickstart.sh
```

The script is safe to rerun: generated secrets are kept, and an installed
instance goes through the migration path.

## Manual install

To control each step:

```bash
cp docker/.env.example .env
```

Set at least:

- `APP_URL` — public URL, for example `https://video.example.com` or
  `http://server.example.com:8080`
- `APP_KEY` — `openssl rand -hex 32`
- `DB_PASSWORD` — URL-safe password, for example
  `openssl rand -base64 24 | tr '+/' '-_' | tr -d '='`

Then:

```bash
docker compose up -d --build
docker compose logs -f bootstrap
```

The first run installs the database schema and writes `/data/.env` and
`/data/config/instance.json`. It does not create an account. The bootstrap log
prints a one-time **owner claim token**. Registration through the gateway is not
loopback, so paste the token. Later runs only apply pending migrations, so the
same command is also the upgrade path.

Open:

- Site: `http://server.example.com:8080`
- Admin: `http://server.example.com:8080/admin/`
- Health: `http://server.example.com:8080/health`

After registering the owner, sign in at `/admin/` with that account and create
additional reviewers or administrators from **Users**.

### Use a different port

Set `GATEWAY_PORT` and keep `APP_URL` in sync:

```dotenv
GATEWAY_PORT=9090
APP_URL=http://server.example.com:9090
```

Only the gateway publishes a host port. PostgreSQL, Redis, the API, the worker,
and the web server stay on the internal Compose network.

## Configuration

Compose interpolates `.env` at container creation. The values below are the ones
most deployments change.

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | no | `uiliuili` | Prefixes container and volume names |
| `GATEWAY_PORT` | no | `8080` | Host port of the Nginx gateway |
| `APP_URL` | yes | `http://localhost:8080` | Public URL; also used for CORS and links |
| `APP_KEY` | yes | — | 64 hex characters; encrypts settings secrets |
| `DB_USER` / `DB_NAME` | no | `uiliuili` | PostgreSQL credentials |
| `DB_PASSWORD` | yes | — | Must be URL-safe because it is embedded in `DATABASE_URL` |
| `DB_SCHEMA` | no | `uiliuili` | Application schema |
| `REDIS_URL` | no | `redis://redis:6379` | Redis is enabled in the stack by default; to run in-memory without it, remove the redis service and the compose default |
| `SITE_NAME` / `SITE_DESCRIPTION` | no | `萌悠` / self-hosted danmaku site | First-install site metadata |
| `SITE_LOCALE` / `SITE_TIMEZONE` / `SITE_REGISTRATION` | no | `zh-CN` / `Asia/Shanghai` / `open` | Initial site settings |
| `STORAGE_DRIVER` | no | `local` | `local` or `s3` on the first install |
| `TRANSCODE_CONCURRENCY` | no | `2` | Concurrent FFmpeg jobs per worker |
| `MEILISEARCH_URL` / `MEILISEARCH_KEY` | no | — | Enables Meilisearch instead of PostgreSQL search |

`docker/.env.example` also lists the `S3_*` and `MAIL_*` variables accepted by
the unattended installer. They are read only when creating a new instance; later
changes belong in the admin settings page. Rotating `APP_KEY` after installation
makes encrypted settings unreadable, so back it up with the database.

### Using an external database or Redis

Remove or override the `postgres` and `redis` services and point
`DATABASE_URL` / `REDIS_URL` at your own instances. For a multi-node deployment,
keep `api` and `worker` on separate hosts, use Redis, and move media to S3. The
gateway can also be replaced with your existing reverse proxy.

## First-run checklist

Spend ten minutes after installation:

- [ ] `/health` returns `200`
- [ ] the first account is the owner and `/admin/` is reachable
- [ ] site name, URL, timezone, and registration policy are correct
- [ ] a short upload moves from transcoding to ready/published
- [ ] the video plays, and comments and danmaku can be sent
- [ ] `docker compose ps` shows api, worker, web, gateway, and postgres healthy
- [ ] HTTPS is configured (production)
- [ ] regular backups cover the database and the `app-data` volume

## Operations

```bash
docker compose ps
docker compose logs -f api worker
docker compose restart api
docker compose exec postgres psql -U uiliuili -d uiliuili
```

Run the CLI inside the stack:

```bash
docker compose run --rm bootstrap node dist/index.js status
docker compose run --rm bootstrap node dist/index.js doctor
docker compose logs bootstrap   # first run: owner claim token
docker compose run --rm bootstrap node dist/index.js owner:promote \
  --username owner --email owner@example.com
```

`bootstrap` is the container entry point. It installs when
`/data/config/instance.json` is missing and migrates otherwise. If it fails, the
API and worker do not start, which prevents a half-installed instance from
serving traffic:

```bash
docker compose logs --tail=200 bootstrap
```

### Lost owner claim token

The token is printed once and stored only as a hash. If no owner exists yet,
`owner:promote` above creates or promotes the account and demotes any current
owner to administrator.

### Upgrade

Back up first, pull the new code, and rebuild:

```bash
git pull
docker compose build
docker compose up -d
docker compose logs -f bootstrap
```

The application code and dependencies live in the images. Persistent state is
only in `/data` and the database, so rebuilding images does not touch user data.
The admin panel is built into the image and updates with the rebuild.

### Backup and restore

Database:

```bash
docker compose exec -T postgres pg_dump -U uiliuili -d uiliuili -Fc > uiliuili.dump
docker compose exec -T postgres pg_restore -U uiliuili -d uiliuili --clean --if-exists < uiliuili.dump
```

Application data (uploads, HLS, `.env`, instance marker):

```bash
docker run --rm -v uiliuili_app-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/app-data.tar.gz -C /data .
docker run --rm -v uiliuili_app-data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/app-data.tar.gz -C /data
```

Use the actual volume name from `docker volume ls` if you changed
`COMPOSE_PROJECT_NAME`. Back up the database and `app-data` together: the
database references media keys stored on that volume.

Restore with the API and worker stopped:

```bash
docker compose stop api worker
docker compose exec -T postgres pg_restore -U uiliuili -d uiliuili --clean --if-exists < uiliuili.dump
docker run --rm -v uiliuili_app-data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/app-data.tar.gz -C /data
docker compose up -d
```

### Reset

```bash
# Keep the database, remove only the instance marker:
docker compose run --rm bootstrap node dist/index.js reset --force

# Delete everything, including uploads, database, and Redis:
docker compose down -v
```

`down -v` is destructive and has no confirmation prompt. Check the volume name
before running it in production.

## TLS and reverse proxy

The gateway listens over plain HTTP. Terminate TLS in front of it with Caddy,
Traefik, or another Nginx:

```nginx
server {
  listen 443 ssl;
  server_name video.example.com;

  client_max_body_size 2g;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

Set `APP_URL=https://video.example.com` so generated links and CORS use the
public HTTPS origin. `TRUST_PROXY` is already enabled in the stack.

## Notes and limits

- **FFmpeg licensing.** The runtime installs Debian's FFmpeg package, which is
  GPL-licensed. FFmpeg is a system dependency and is not linked into the MIT
  application code; distributing the image still means distributing FFmpeg. If
  that matters to you, build your own runtime image with an LGPL build.
- **One host by default.** The Compose stack runs PostgreSQL and Redis next to
  the application. For horizontal scaling, move them out and use S3 storage.
- **Uploads.** The gateway allows request bodies up to 2 GB. Raise
  `client_max_body_size` in `docker/nginx.conf` and in any outer proxy if you
  configure a higher upload limit.
- **Backups are not automatic.** Schedule the commands above or use your own
  PostgreSQL and volume backup tooling.
- **Local test folder.** `docker-test/` is listed in `.gitignore` so a local
  deployment directory with generated secrets cannot be committed by accident.
