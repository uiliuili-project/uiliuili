# Troubleshooting

> [简体中文](zh-CN/troubleshooting.md)

Collect the basics first:

```bash
# Docker
docker compose ps
docker compose logs --tail=100 bootstrap api worker

# Native
pnpm cli status
pnpm cli doctor
journalctl -u uiliuili-api -u uiliuili-worker -n 100 --no-pager
```

`pnpm cli doctor` checks Node.js, FFmpeg, PostgreSQL, write permissions, and
migration status. It is the first stop for a native install.

## Installation

### `APP_KEY` is invalid, or encrypted settings cannot be read

`APP_KEY` must be **64 hex characters** (32 bytes):

```bash
openssl rand -hex 32
```

Never change `APP_KEY` after installation. S3, SMTP, OAuth, captcha, and AI
moderation secrets in the database are encrypted with it; a new key makes them
unreadable and they must be entered again. Back up `.env` together with the
database.

### Database connection or `DATABASE_URL` parse error

- URL-encode special characters in the password (`@`, `:`, `/`, `#`, `?`; for
  example `@` becomes `%40`).
- Docker's `DB_PASSWORD` is embedded directly in the connection string. Use only
  letters, digits, `-`, `_`, and `.`. The command
  `openssl rand -base64 24 | tr '+/' '-_' | tr -d '='` satisfies this.
- Confirm PostgreSQL is running and the database and user exist:

```bash
pg_isready -h 127.0.0.1 -p 5432
psql "$DATABASE_URL" -c 'select 1'
```

### The installer will not open, or keeps asking for a token

- A PostgreSQL version below 16, missing privileges, or an interrupted migration
  leaves the API in install-only mode.
- Native: the installer token is printed at API startup and written to
  `storage/install-token`:

```bash
cat storage/install-token
journalctl -u uiliuili-api -n 50 --no-pager | grep -i token
```

- Docker: `docker compose logs bootstrap | grep -i token`.
- Set `INSTALL_ALLOW_LOCALHOST=true` only for local development, never in
  production.
- Seeing the installer after a successful install means `config/instance.json`
  is missing or `UILIUILI_ROOT` points at another directory. Make the service
  working directory and `UILIUILI_ROOT` agree.

### The owner claim token is lost

The claim token is displayed once and stored only as a hash. If no owner exists
yet:

```bash
# Native
pnpm cli owner:promote --username owner --email owner@example.com

# Docker
docker compose run --rm bootstrap node dist/index.js owner:promote \
  --username owner --email owner@example.com
```

The command creates or promotes the target account and demotes the current owner
to administrator. `admin:create` is an alias.

### The `bootstrap` container exits and the API never starts

That is intentional: when `bootstrap` fails, the API and worker stay down so a
half-installed instance cannot serve traffic.

```bash
docker compose logs --tail=200 bootstrap
```

Common causes: an empty or malformed `APP_KEY`, a `DB_PASSWORD` with special
characters, wrong volume permissions, or a full disk. Fix the cause and run
`docker compose up -d` again; `bootstrap` retries the migration.

### Port already in use

```bash
ss -ltnp | grep 8080
```

Change `GATEWAY_PORT` and `APP_URL` together, or run:

```bash
./scripts/quickstart.sh --port 9090
```

For a native install, change `API_PORT` and the Nginx `proxy_pass`.

## Runtime

### Pages load but every API request fails

- Check the health endpoint:

```bash
curl -i http://127.0.0.1:8080/health
```

- Nginx must proxy `/api`, `/media`, and `/socket.io` to the API and `/` to
  Next.js. See `infra/nginx/uiliuili.conf`.
- Behind a reverse proxy set `TRUST_PROXY=true`, otherwise rate limits, region
  resolution, and installer checks see the proxy address.
- `APP_URL` must match the browser origin exactly (scheme, host, port). A
  mismatch breaks cookies, CORS, and OAuth callbacks.

### Sessions end immediately, or writes fail CSRF checks

Mutating requests need an `x-csrf-token` header matching the `ul_csrf` cookie.
The web app handles this automatically. For a custom client or proxy:

- do not strip `Set-Cookie` or `Cookie`;
- keep the frontend and API on the same origin, or configure
  `NEXT_PUBLIC_API_URL` correctly;
- use the same HTTPS origin that users open.

### Danmaku does not sync, or WebSocket fails

- Nginx must forward upgrade headers:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

- Multiple API instances require `REDIS_URL`; without it Socket.IO broadcasts
  only inside one process.
- Check in the browser console that `/socket.io` reaches the API and not a
  static file server.

### Uploads return 413

The request body exceeds the Nginx limit. The Docker gateway defaults to 2 GB;
raise it in `docker/nginx.conf`:

```nginx
client_max_body_size 2g;
```

Do the same in the native site config and keep `proxy_request_buffering off;`
(the example config already does). Also check the upload limit in the admin
settings.

### Uploads finish but transcoding stays queued

1. Confirm the worker runs:

```bash
docker compose ps worker
journalctl -u uiliuili-worker -n 100 --no-pager
```

2. Confirm both binaries are available:

```bash
ffmpeg -version
ffprobe -version
```

3. Raise `TRANSCODE_CONCURRENCY` for a backlog, but stay within CPU capacity.
   Adding worker instances scales better than over-committing one host.
4. A full disk makes jobs fail repeatedly. Check the partition holding
   `storage/` and the database.

### The admin panel still shows old code

The admin panel is static files served by Nginx (`apps/admin/dist`). After an
upgrade rebuild it and replace that directory, then refresh the browser cache.
Restarting the API does not update the panel. Docker rebuilds the image.

### Pending migrations / schema mismatch after an upgrade

```bash
pnpm cli migrate          # native
docker compose up -d      # Docker: bootstrap migrates automatically
```

You can also open **Admin → System → Upgrade center**, create a backup, and run
the database upgrade there. Always back up the database and `.env` first.

### Locked out and mail is unavailable

Reset from the server or promote another account:

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

If SMTP is configured, the login page's password reset also works.

### Integration secrets no longer decrypt after an upgrade

`APP_KEY` changed. Restore the previous `.env`. If it is gone, re-enter the S3,
SMTP, OAuth, captcha, and AI moderation secrets in the admin settings.

## Performance and capacity

- **Slow transcoding.** libx264 at `veryfast` needs roughly 2–3 vCPU per 1080p
  rendition. Set `TRANSCODE_CONCURRENCY` to about one third of physical cores.
- **Playback stalls.** Check bandwidth first. 100 viewers at 720p need about
  280 Mbps sustained egress; put a CDN in front above roughly 100 Mbps.
- **Slow database.** Use NVMe or provisioned IOPS, and set `shared_buffers` to
  about 25% of RAM.
- **Out of memory.** Budget 300–600 MB RSS per FFmpeg job plus Node.js overhead,
  and keep 2–4 GB of swap as an OOM guard.

See [native deployment — recommended hardware](deployment.md#recommended-hardware)
for sizing.
