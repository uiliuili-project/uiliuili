# Native deployment

> [简体中文](zh-CN/deployment.md)

A native deployment does not require Docker. A typical environment:

- Node.js 22
- PostgreSQL 16+
- FFmpeg 6+ (7 recommended)
- optional Redis and Meilisearch
- Nginx
- systemd

Want the fastest path? Use [Docker deployment](docker.md). The full first-time
procedure is in [installation · native install](installation.md#native-install);
this page focuses on production configuration.

## Recommended hardware

Sizing is driven by three loads: FFmpeg transcoding (CPU), concurrent playback
(network), and API plus PostgreSQL (memory and disk IOPS). The table is a
starting point for H.264 sources up to 1080p; benchmark with your own content
before committing to a tier.

| Scenario | vCPU | RAM | System disk | Data disk | Bandwidth | `TRANSCODE_CONCURRENCY` |
| --- | --- | --- | --- | --- | --- | --- |
| Development / evaluation | 2 | 4 GB | 40 GB SSD | — | — | 1 |
| Personal instance or small team | 2–4 | 4–8 GB | 40–60 GB SSD | 200 GB+ | 10 Mbps | 1 |
| Small community | 4–8 | 8–16 GB | 60–100 GB SSD | 500 GB–1 TB | 50–100 Mbps | 2 |
| Medium community | 8–16 | 16–32 GB | 100 GB SSD | 2–4 TB NVMe | 200 Mbps–1 Gbps | 3–4 |

For a large deployment, split roles instead of buying one bigger machine:

- 2 or more API nodes, each 4–8 vCPU and 8–16 GB RAM, behind Nginx; Redis is
  required in this mode.
- 1–4 worker nodes, each 16 vCPU and 32 GB RAM with NVMe scratch space.
- PostgreSQL on its own host: 8–16 vCPU, 32–64 GB RAM, NVMe, with a replica for
  backups and failover.
- Redis 2–8 GB, Meilisearch 4–8 vCPU and 8–16 GB RAM, media on S3 plus a CDN.

These are planning guidelines, not benchmarks. A 2-core VPS with 4 GB RAM is
enough to try MoeYou, but it will fall behind as soon as several 1080p uploads
and a few hundred viewers overlap.

### Capacity and transcoding concurrency

- Each video is transcoded rendition by rendition (360p, 480p, 720p, 1080p), so
  one job occupies one worker slot for its whole ladder.
- libx264 at `veryfast` uses roughly 2–3 vCPU per 1080p rendition and 1–2 vCPU
  per 720p rendition. Set `TRANSCODE_CONCURRENCY` to about one third of the
  cores for 1080p, or one half for 720p, and leave 1–2 cores for the API,
  PostgreSQL, and the OS.
- More concurrency shortens the queue but does not raise throughput once the CPU
  is saturated; it only makes every job slower. Scale workers horizontally
  instead.
- Cap the ladder with the upload max resolution setting (`maxResolution`, 720p)
  on small machines; this roughly halves CPU time and output size.
- Expect 300–600 MB RSS per FFmpeg job, plus Node.js overhead per process.

### Storage and bandwidth estimates

- The 1080p ladder (360p + 480p + 720p + 1080p) produces about 4–5 GB of HLS per
  hour of source video. A 720p-only ladder produces about 2–3 GB per hour.
- Keep the original upload if you allow re-transcoding, and add 30% free space
  plus room for backups. A 1 TB data disk holds roughly 100–150 hours of 1080p
  content including originals.
- Bandwidth is concurrent viewers × the rendition they play. 100 viewers at
  720p (~2.8 Mbps) need about 280 Mbps. Put a CDN in front of media above
  roughly 100 Mbps of sustained egress.
- PostgreSQL needs fast random IO; use NVMe or provisioned IOPS, and set
  `shared_buffers` to about 25% of RAM. A single small instance is fine up to
  about 1,000 daily active users; 10,000 users warrants 4–8 vCPU and 16 GB.
- Redis typically stays below 1 GB. Meilisearch needs roughly the size of the
  indexed text, commonly 2–4 GB for 100,000 videos.

Use a 64-bit Linux distribution, **Ubuntu 24.04 LTS or Debian 13**, XFS or ext4,
and 2–4 GB of swap as an OOM guard. Swap does not replace RAM for transcoding.

Debian 12 also works, but its FFmpeg and PostgreSQL are old: install PostgreSQL
16+ from [PGDG](https://www.postgresql.org/download/linux/debian/) and a newer
FFmpeg from backports. Ubuntu 24.04 ships FFmpeg 6.1, which meets the minimum.

## Layout and user

```text
/opt/uiliuili/          application
/opt/uiliuili/.env      created by the installer or by hand
/opt/uiliuili/config/   instance marker
/opt/uiliuili/storage/  local uploads and temp files
```

Create a dedicated service user and make the writable directories owned by it:

```bash
sudo useradd --system --home /opt/uiliuili --shell /usr/sbin/nologin uiliuili
sudo chown -R uiliuili:uiliuili /opt/uiliuili
sudo chmod 600 /opt/uiliuili/.env
```

The service user needs read/write access to `config/`, `storage/`, and `.env`.
Nginx needs read access to `apps/admin/dist`.

## Build

```bash
cd /opt/uiliuili
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

If you built as another user, run the `chown` above again so the service user can
write to `storage/`.

Build outputs:

| App | Output |
| --- | --- |
| API | `apps/api/dist/main.js` |
| worker | `apps/worker/dist/main.js` |
| public site | `apps/web/.next`, started by Next.js |
| admin | `apps/admin/dist`, served directly by Nginx |
| CLI | `apps/cli/dist/index.js` |

## Nginx

Copy `infra/nginx/uiliuili.conf` to `/etc/nginx/sites-available/uiliuili`,
adjust `root` and `alias` to your installation path, enable it, and reload:

```bash
sudo cp infra/nginx/uiliuili.conf /etc/nginx/sites-available/uiliuili
sudo ln -s /etc/nginx/sites-available/uiliuili /etc/nginx/sites-enabled/uiliuili
sudo nginx -t
sudo systemctl reload nginx
```

Key points:

- `/admin/` reads static files from `apps/admin/dist`; it does not go through
  Next.js.
- `/api/`, `/media/`, and `/socket.io/` proxy to the API (default
  `127.0.0.1:3001`).
- `/health` proxies exactly to the API for probes and load balancers.
- `/api/install/` disables `proxy_request_buffering` so install requests stream.
- `client_max_body_size` controls upload size and defaults to 2 GB.

Enable HTTPS in production. Let's Encrypt example:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d video.example.com
```

Then set `APP_URL=https://video.example.com` in `.env` and restart the API.

Behind Nginx set `TRUST_PROXY=true` so rate limiting, region resolution, and
installer checks see the real client IP. Do not enable it when the API is
directly exposed to the internet.

## systemd

Copy the units and start them:

```bash
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uiliuili-api uiliuili-worker uiliuili-web
```

All three call `node` directly and do not depend on a global pnpm shim:

- `uiliuili-api`: `apps/api/dist/main.js`
- `uiliuili-worker`: `apps/worker/dist/main.js`
- `uiliuili-web`: starts Next.js from `apps/web`

The API unit restarts automatically when the installer exits with code 75. Logs:

```bash
systemctl status uiliuili-api uiliuili-worker uiliuili-web
journalctl -u uiliuili-api -f
journalctl -u uiliuili-worker -f
```

If you use a different installation directory, update `WorkingDirectory`,
`EnvironmentFile`, and `ExecStart` in the units.

## First install

The full token and owner flow is in
[installation · native install](installation.md#native-install). On a server,
prefer:

```bash
pnpm cli doctor
pnpm cli install --from-env
```

Or start the API and open `https://your-domain/admin/install`. After installation
the API restarts and the installer endpoints close permanently.

## After installation

- `curl -i https://your-domain/health` returns `200`;
- the admin console is reachable and the first account is the owner;
- an uploaded video transcodes and plays;
- the worker log has no repeated failures;
- `pnpm cli status` reports no pending migrations;
- paths, hostnames, and ports agree across Nginx and `.env`.

## Scaling

- Multiple API instances require Redis for shared cache, rate limiting, and
  Socket.IO broadcasting.
- Multiple workers can run against the same PostgreSQL queue. Jobs are claimed
  with `FOR UPDATE SKIP LOCKED`.
- Use S3 storage when API and worker are not on the same host.
- Put a CDN in front of public media when possible.
- The admin panel is static; deploy a copy of `apps/admin/dist` on each Nginx
  node.

## Development

Local development, tests, and the repository layout are in
[development](development.md). Do not run `pnpm dev` on a production server.
