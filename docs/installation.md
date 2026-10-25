# Installation

> [简体中文](zh-CN/installation.md)

## Requirements

- Node.js 22 or newer
- PostgreSQL 16 or newer
- FFmpeg 7 with `ffmpeg` and `ffprobe` available
- Optional: Redis 7, Meilisearch 1.x, S3-compatible storage, SMTP server

## Build

Run `pnpm cli doctor` after installing dependencies to check Node.js, FFmpeg,
PostgreSQL, write permissions, and migration status.

```bash
corepack enable
pnpm install
pnpm build
```

## Start

Start the API, worker, Next.js web app, and admin app under your process
manager (systemd units are provided in `infra/systemd`).

On first boot the API detects that `config/instance.json` is missing and starts
in install-only mode. Visit the web root. It links to `/admin/install`.

The installer requires a one-time token. The API prints it at startup and stores
it in `storage/install-token`. In development, loopback requests can bypass the
token when `INSTALL_ALLOW_LOCALHOST=true`.

## Installer steps

1. Environment check
2. PostgreSQL connection and schema
3. Site information and administrator account
4. Local or S3 storage
5. Optional Redis, Meilisearch, SMTP, OAuth
6. Review and install

The installer writes `.env` and `config/instance.json`, runs migrations and
seeds in a transaction, creates the administrator, then disables itself and
requests a service restart.

## Headless install

```bash
pnpm cli install --config install.json
```

See `docs/configuration.md` for the config format.

## First checks

After installation, open the admin system page and verify:

- database and migration status;
- FFmpeg availability;
- storage write test;
- optional mail test;
- queue worker status.
