# Configuration

> [简体中文](zh-CN/configuration.md)

The installer writes two files:

- `.env` — infrastructure and secrets, mode `0600`
- `config/instance.json` — installation marker, instance ID, versions

Do not commit either file.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SCHEMA` | Application schema (fixed to `uiliuili` in this release) |
| `APP_KEY` | 32-byte hex key for encrypting provider secrets |
| `UILIUILI_ROOT` | Directory for `.env`, `config/` and `storage/`; defaults to the working directory (containers use `/data`) |
| `APP_URL` | Public site URL |
| `API_INTERNAL_URL` | Internal API URL used by Next.js SSR |
| `NEXT_PUBLIC_API_URL` | Public API base, usually empty for same-origin |
| `REDIS_URL` | Optional Redis connection |
| `MEILISEARCH_URL`, `MEILISEARCH_KEY` | Optional search engine |
| `API_PORT` | API port, default 3001 |
| `STORAGE_ROOT` | Local upload directory |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Binary paths |
| `TRANSCODE_CONCURRENCY` | Worker concurrency |
| `INSTALL_TOKEN` | Optional fixed installer token |
| `INSTALL_ALLOW_LOCALHOST` | Allow loopback installer access without token |
| `TRUST_PROXY` | Trust reverse-proxy headers |

Environment variables take precedence over database settings.

## Install JSON

```json
{
  "locale": "zh-CN",
  "database": {
    "host": "127.0.0.1",
    "port": 5432,
    "database": "uiliuili",
    "user": "uiliuili",
    "password": "change-me",
    "ssl": false,
    "schema": "uiliuili",
    "createIfMissing": true
  },
  "site": {
    "name": "uiliuili",
    "description": "A self-hosted video community",
    "url": "https://video.example.com",
    "timezone": "Asia/Shanghai",
    "locale": "zh-CN",
    "registration": "open"
  },
  "storage": { "driver": "local", "localPath": "./storage/uploads" },
  "search": { "driver": "postgres" },
  "demoContent": false
}
```

## Site settings

Runtime settings are stored in PostgreSQL and can be edited in the admin panel:
site information (including the site logo), registration, upload limits,
playback defaults, danmaku rules, social limits, recommendation weights,
storage, transcoding, mail, OAuth, search, security, and audit retention.

Secrets in the database are encrypted with `APP_KEY`. Back up `.env`; losing
`APP_KEY` makes stored provider secrets unreadable.

## User groups and interfaces

Each user row stores a `user_group` marker. Roles remain the source of truth for
permissions; the marker is recalculated whenever a role changes and is
backfilled for existing accounts during migration.

| Roles | Group | Label | Interface |
| --- | --- | --- | --- |
| `USER` | `USER` | User | Creator center |
| `UPLOADER` | `CREATOR` | Creator | Creator center |
| `REVIEWER` | `REVIEWER` | Reviewer | Review desk at `/admin/review` |
| `ADMIN` | `ADMIN` | Administrator | Admin console at `/admin/` |
| `SUPER_ADMIN` | `OWNER` | Owner | Everything, including ownership transfer |

The creator center lives at `/studio`. Reviewers get video, comment, danmaku,
and report moderation in the review desk. Administrators add feature flags,
user moderation, categories, announcements, site and content settings, system
status, and the audit log. The owner additionally controls integration and
security settings, role assignment, and passes ownership to another account.

At most one account can be the owner; a partial unique index enforces it. The
first account registered after installation automatically becomes the owner,
and the installer no longer creates an initial administrator. The installer
prints a one-time **owner claim token**; registration from a non-loopback
address must present it. Loopback registration (the server itself) does not.
The token is stored hashed and is removed as soon as an owner exists.

If the owner account is lost, recover it with the CLI:

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

`admin:create` remains an alias. The command demotes the current owner to
administrator and promotes or creates the target account inside a transaction.

