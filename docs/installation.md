# Installation

> [简体中文](zh-CN/installation.md)

MoeYou has two installation paths:

| Path | Best for | Time |
| --- | --- | --- |
| [Docker](#docker) | Fastest working site, containers are fine | ~5 minutes |
| [Native](#native-install) | Running directly on the host, existing Nginx/PostgreSQL, custom process management | ~15–30 minutes |

For a single complete server, Docker is recommended. Use the native path when
you need to share an existing PostgreSQL, keep the app on the host, or manage
processes yourself.

## Requirements

| Component | Requirement |
| --- | --- |
| Node.js | 22 or newer |
| pnpm | 9.15.9 via `corepack enable` |
| PostgreSQL | 16 or newer (15 runs with a warning) |
| FFmpeg / ffprobe | 6 or newer; 7 recommended, both on `PATH` |
| OS | Ubuntu 24.04 LTS or Debian 13; Debian 12 needs newer FFmpeg and PostgreSQL |
| Optional | Redis 7, Meilisearch 1.x, S3-compatible storage, SMTP, OAuth |

The Docker image bundles Node.js 22 and FFmpeg 7; the host only needs Docker
Engine and Compose v2.

## Docker

```bash
git clone https://github.com/uiliuili-project/uiliuili.git
cd uiliuili
./scripts/quickstart.sh
```

The script creates `.env`, generates `APP_KEY` and `DB_PASSWORD`, builds and
starts the stack, waits for the health check, and prints the site URL plus the
**one-time owner claim token**.

Open <http://localhost:8080>, register the first account with that token, then
sign in at <http://localhost:8080/admin/>.

Change the port:

```bash
./scripts/quickstart.sh --port 9090
```

For manual configuration, production deployment, backups, and TLS, see
[Docker deployment](docker.md). Docker users can skip the native steps below.

## Native install

The commands below use Ubuntu 24.04 / Debian 13 and `/opt/uiliuili`.

### 1. System packages

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates postgresql redis-server ffmpeg
```

Verify:

```bash
node --version     # v22 or newer
ffmpeg -version
ffprobe -version
psql --version     # 16 or newer
```

Debian 12 ships older FFmpeg and PostgreSQL. Install PostgreSQL 16+ from
[PGDG](https://www.postgresql.org/download/linux/debian/) and a newer FFmpeg
from backports, or use Docker instead.

### 2. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER uiliuili WITH PASSWORD 'change-me';
CREATE DATABASE uiliuili OWNER uiliuili;
SQL
```

Replace `change-me` with a strong password and use the same one in
`DATABASE_URL`.

URL-encode special characters before putting the password in `DATABASE_URL`, or
generate a URL-safe password:

```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

Redis is optional for a single node. It is required for multiple API instances
or cross-process danmaku broadcasting.

### 3. Code and build

```bash
sudo mkdir -p /opt/uiliuili
sudo chown "$USER":"$USER" /opt/uiliuili
git clone https://github.com/uiliuili-project/uiliuili.git /opt/uiliuili
cd /opt/uiliuili

corepack enable
pnpm install --frozen-lockfile
pnpm build
```

`pnpm build` builds the API, worker, public site, admin panel, and CLI. `pnpm
cli` only works after it finishes.

### 4. Environment

```bash
cp .env.example .env
```

Set at least:

```dotenv
NODE_ENV=production
APP_URL=https://video.example.com
API_INTERNAL_URL=http://127.0.0.1:3001
DATABASE_URL=postgres://uiliuili:change-me@127.0.0.1:5432/uiliuili
APP_KEY=<openssl rand -hex 32>
INSTALL_ALLOW_LOCALHOST=false
```

- `APP_URL` must be the exact origin users open (scheme, host, port).
- `APP_KEY` is 64 hex characters. Never change it after installation, and back
  it up with the database.
- Redis, Meilisearch, S3, SMTP, and transcoding settings are described in
  [configuration](configuration.md).

Check the host and database:

```bash
pnpm cli doctor
```

### 5. Install

Choose one.

**Command line (recommended on a server)**

```bash
pnpm cli install --from-env
```

It reads `DATABASE_URL`, `APP_URL`, `APP_KEY`, `SITE_*`, `STORAGE_*` and related
variables from `.env`, runs migrations and seeds, and prints the owner claim
token. A JSON config also works:

```bash
pnpm cli install --config install.json
```

**Web installer**

Start the API first (step 6), then open
`https://video.example.com/admin/install`. The installer token is printed at
API startup and written to `storage/install-token`:

```bash
cat storage/install-token
```

The installer writes `.env` and `config/instance.json`, runs migrations and
seeds in a transaction, then disables the installer endpoints and requests a
restart. It does **not** create an account.

### 6. Start the services

A native deployment runs three processes (API, worker, web); the admin panel is
static files. Use the provided systemd units and Nginx config. First create the
service user and fix permissions as described in
[native deployment · layout and user](deployment.md#layout-and-user):

```bash
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uiliuili-api uiliuili-worker uiliuili-web
```

Permissions and Nginx setup are in [native deployment](deployment.md). For a
local smoke test you can also run:

```bash
node apps/api/dist/main.js
node apps/worker/dist/main.js
pnpm --filter @uiliuili/web start
```

### 7. Create the owner

Open the site and register the first account. It becomes the owner with every
permission.

- Registration from the server itself (loopback) needs no token.
- Any other address must provide the **owner claim token** printed during
  installation.
- Do this before opening the site to visitors: while no owner exists, the first
  registration bypasses the registration policy.

The token is stored hashed and shown once. If it is lost or the owner account is
unavailable:

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

Without `--password`, a random password is generated and printed. Later,
transfer ownership from **Admin → Users → Make owner**.

## After installation

Open the admin system page and verify:

- database connection and migration status, with no pending migrations;
- FFmpeg availability;
- the storage write test;
- the worker is running and the queue is not backlogged;
- the reverse proxy or CDN sends the configured country header, or
  `region.fallback` is what you expect;
- the country list under **Settings → Regions and restricted content**.

Then upload a short video once: confirm it transcodes, plays, and accepts
comments and danmaku.

## Next

- Nginx, HTTPS, systemd, and capacity: [native deployment](deployment.md)
- Site settings and environment variables: [configuration](configuration.md)
- Upgrade, backup, and restore: [upgrade and backup](upgrade.md)
- Something is broken: [troubleshooting](troubleshooting.md)
