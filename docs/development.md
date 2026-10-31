# Development

> [简体中文](zh-CN/development.md)

This guide is for contributors changing code or writing extensions. To deploy a
site, see [installation](installation.md) or [Docker deployment](docker.md).

## Prerequisites

| Dependency | Version | Notes |
| --- | --- | --- |
| Node.js | 22+ | Declared in `engines` |
| pnpm | 9.15.9 | Enable with `corepack enable` |
| PostgreSQL | 16+ | Required for local development |
| FFmpeg / ffprobe | 6+ (7 recommended) | Transcoding and media probing |
| Redis | 7, optional | Multi-instance or Socket.IO fan-out testing |

```bash
corepack enable
pnpm install
```

If PostgreSQL is not installed locally, start only the dependencies in Docker
and keep the apps on the host:

```bash
docker run -d --name uiliuili-dev-db \
  -e POSTGRES_USER=uiliuili \
  -e POSTGRES_PASSWORD=uiliuili \
  -e POSTGRES_DB=uiliuili \
  -p 5432:5432 postgres:16-alpine

docker run -d --name uiliuili-dev-redis -p 6379:6379 redis:7-alpine
```

## Configuration

```bash
cp .env.example .env
```

Minimum for development:

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgres://uiliuili:uiliuili@127.0.0.1:5432/uiliuili
APP_KEY=<openssl rand -hex 32>
INSTALL_ALLOW_LOCALHOST=true
```

`INSTALL_ALLOW_LOCALHOST=true` is for local development only; production must
keep it `false`. See [configuration](configuration.md) for the rest.

## Run the development servers

Everything at once:

```bash
pnpm dev
```

Or individually, to follow one process's logs:

```bash
pnpm --filter @uiliuili/api dev      # http://127.0.0.1:3001
pnpm --filter @uiliuili/worker dev
pnpm --filter @uiliuili/web dev      # http://localhost:3000
pnpm --filter @uiliuili/admin dev    # http://localhost:5173/admin/
```

Default ports:

| App | URL |
| --- | --- |
| Public site (Next.js) | <http://localhost:3000> |
| Admin (Vite) | <http://localhost:5173/admin/> |
| API | <http://127.0.0.1:3001> |
| Swagger | <http://127.0.0.1:3001/api/docs> |

Next.js rewrites `/api` and `/media` to `API_INTERNAL_URL` (default
`http://127.0.0.1:3001`), and Vite proxies the same prefixes. The **danmaku
WebSocket bypasses the rewrite**, so web development needs:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm --filter @uiliuili/web dev
```

## First install

Before installation the API exposes only installer endpoints. Choose one:

**Web installer.** Start the API and open <http://localhost:3000/admin/install>.
The token is printed at API startup and written to `storage/install-token`.

**Command line.**

```bash
pnpm build
pnpm cli install --from-env
```

`--from-env` reads `DATABASE_URL`, `APP_URL`, `APP_KEY`, `SITE_*`, `STORAGE_*`,
and similar variables, then runs migrations and seeds. A JSON config works too:
`pnpm cli install --config install.json`.

Restart the API after installation, then register the first account to become
the owner.

Common operations:

```bash
pnpm cli status                 # instance and migration status
pnpm cli doctor                 # environment checks
pnpm cli migrate                # apply pending migrations
pnpm cli owner:promote --username owner --email owner@example.com
pnpm cli reset --force          # remove the instance marker (keeps the database)
```

## Database and migrations

The schema lives in `packages/db/src/schema.ts`; migrations are in
`packages/db/migrations`.

After changing the schema:

```bash
pnpm db:generate
```

Review the generated SQL before committing, especially data backfills and
destructive changes. `pnpm cli migrate` or the admin upgrade center applies
migrations; application startup never migrates automatically.

## Checks

Run before opening a pull request:

```bash
pnpm lint        # Biome
pnpm typecheck   # every workspace
pnpm test        # Vitest unit tests
pnpm build       # production build
```

Single package:

```bash
pnpm --filter @uiliuili/api test
pnpm --filter @uiliuili/web typecheck
```

Format and autofix:

```bash
pnpm format
pnpm lint:fix
```

## Repository layout

```text
apps/
  api/             NestJS API, auth, installer endpoints, WebSocket
  worker/          FFmpeg transcoding, indexing, recommendations, cleanup
  web/             Next.js public site
  admin/           Vite + React admin console and installer wizard
  cli/             Install and operations command line
  video-node/      Optional external video node for another host
packages/
  db/              Drizzle schema, migrations, seeds
  installer/       Install validation, config generation, migration runner
  media/           Storage drivers, FFmpeg, HLS
  shared/          Zod contracts, permissions, error codes
  danmaku/         Canvas engine and Bilibili XML conversion
  i18n/            Chinese and English catalogs
  video-node-contract/  Protocol between the main site and video nodes
infra/             Nginx, systemd, backup and install scripts
docs/              Documentation (Chinese under docs/zh-CN)
```

## Conventions

- Biome owns formatting and linting; TypeScript runs in strict mode.
- Validate API input with Zod schemas and return errors through the shared
  exception filter.
- Roles are the permission source; the user group only selects an interface.
  Add a permission in `packages/shared` and at every use site.
- All user-visible strings live in `packages/i18n`. Add Chinese and English
  together.
- Annotate new endpoints for Swagger. Add unit tests for permission, region, or
  moderation logic.
- Follow the existing transaction pattern so interaction rows and counters stay
  consistent.

## Language catalogs

`packages/i18n/src/locales/` holds `zh-CN`, `en-US`, and the admin's
`ui-en.ts`. A new key must exist in both languages; a missing translation falls
back to Chinese. The site language can be changed in site settings and user
preferences.

## Commits and pull requests

- Follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- One change per commit; keep a migration and the code that uses it together.
- Describe the motivation, behavior change, verification, and screenshots for
  interface changes.
- Make sure `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes.

See [CONTRIBUTING.md](../CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) for more.
