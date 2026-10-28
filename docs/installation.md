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
3. Site information
4. Local or S3 storage
5. Optional Redis, Meilisearch, SMTP, OAuth
6. Review and install

The installer writes `.env` and `config/instance.json`, runs migrations and
seeds in a transaction, then disables itself and requests a service restart.
It does **not** create an administrator. The install result shows a one-time
owner claim token; save it, because it is only displayed once.

## Create the owner

Open the site and register the first account. That account becomes the owner
and receives every permission. When you register from the server itself
(loopback), no token is required. From any other address, paste the owner claim
token shown by the installer.

Do this before opening the site to visitors: while no owner exists, the first
registration bypasses the registration policy. The claim token is stored
hashed, and the record is removed as soon as the owner exists.

If the token is lost or the owner account is unavailable, recover with:

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

`admin:create` is kept as an alias. Ownership can later be transferred from
**Admin → Users → Make owner**; the current owner is demoted to administrator.

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
