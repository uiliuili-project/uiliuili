# uiliuili

> An open-source, self-hosted danmaku video platform with a WordPress-style installer.

uiliuili is a complete video community: uploads, FFmpeg HLS transcoding, a Canvas danmaku player, comments, follows, favorites, coins, notifications, search, recommendations, and a visual admin panel.

- **License:** MIT
- **Stack:** NestJS · PostgreSQL · Drizzle · Next.js · React · Ant Design · FFmpeg
- **Hard dependencies:** Node.js 22, PostgreSQL 16+, FFmpeg 7+
- **Optional:** Redis, Meilisearch, S3-compatible storage, SMTP, GitHub/Google/OIDC login
- **Queue:** PostgreSQL-backed jobs with `FOR UPDATE SKIP LOCKED`
- **Runtime:** No Docker required

## Features

- First-run web installer: environment checks, database setup, admin account, storage, optional mail/OAuth.
- Multi-quality HLS playback with resumable uploads and FFmpeg transcoding.
- Real-time danmaku with history segments, filters, moderation, Bilibili XML import/export.
- Social features: follows, comments, likes, coins, favorites, history, notifications.
- Search and recommendations with PostgreSQL fallback; optional Meilisearch.
- Admin panel: users, videos, danmaku, comments, reports, categories, settings, jobs, audit.
- Local storage or S3-compatible object storage. Single-node mode without Redis.
- Chinese-first UI with an i18n foundation for English.

## Quick start (self-hosted)

Prerequisites:

```bash
node --version    # >= 22
psql --version    # PostgreSQL 16+
ffmpeg -version   # 7+
```

Install and build:

```bash
corepack enable
pnpm install
pnpm build
cp .env.example .env   # optional; the installer writes .env for you
pnpm start:api
pnpm start:worker
pnpm start:web
```

Start the web app with `pnpm start:web` and serve `apps/admin/dist` at `/admin`
with Nginx (or use `pnpm --filter @uiliuili/admin dev` for development). Open
`http://localhost:3000`; until the instance is configured the home page links to
`/admin/install`. The installer asks for a one-time token printed in the API
console (or stored in `storage/install-token`).

For a headless installation:

```bash
pnpm cli install --config install.json
```

## Development

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

The repository is a pnpm + Turborepo monorepo:

```text
apps/api       NestJS API and installer endpoints
apps/worker    FFmpeg transcoding, search indexing, recommendations
apps/web       Next.js public site
apps/admin     React admin panel and installer wizard
apps/cli       Headless installer and operations CLI
packages/*     Database, installer, media, shared contracts, danmaku, i18n
```

## Documentation

- [Architecture](docs/architecture.md)
- [Installation](docs/installation.md)
- [Configuration](docs/configuration.md)
- [S3 storage](docs/s3.md)
- [Native deployment](docs/deployment.md)
- [Mail and OAuth](docs/oauth.md)
- [Upgrade and backup](docs/upgrade.md)
- [Danmaku](docs/danmaku.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues should follow
[SECURITY.md](SECURITY.md).

## License

MIT © 2026 uiliuili contributors.
