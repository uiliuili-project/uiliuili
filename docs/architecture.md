# Architecture

> [简体中文](zh-CN/architecture.md)

uiliuili is a modular monolith with a separate worker process.

```text
Browser
  │
Nginx ── Next.js public site
  │    ├─ Admin SPA
  │    └─ /api ── NestJS API
  │                   ├─ PostgreSQL (business data + job queue)
  │                   ├─ optional Redis (cache, limits, pub/sub)
  │                   ├─ optional Meilisearch
  │                   └─ Local disk / S3
  │
Worker ── FFmpeg ── HLS ── storage
```

Hard dependencies are Node.js 22+, PostgreSQL 16+, and FFmpeg 7+. Redis and
Meilisearch are optional. Without Redis, the API runs in single-node mode with
in-memory cache, rate limiting, and WebSocket broadcasting. Jobs are stored in
PostgreSQL and claimed with `FOR UPDATE SKIP LOCKED`, so workers can scale
independently.

## Applications

| App | Responsibility |
| --- | --- |
| `apps/api` | REST API, auth, installer endpoints, WebSocket gateway |
| `apps/worker` | Transcoding, thumbnails, search indexing, recommendations, cleanup |
| `apps/web` | Next.js public site |
| `apps/admin` | React admin panel and installer wizard |
| `apps/cli` | Headless install and operations |

## Packages

| Package | Responsibility |
| --- | --- |
| `@uiliuili/db` | Drizzle schema, SQL migrations, seeds |
| `@uiliuili/installer` | Install validation, config generation, migration runner |
| `@uiliuili/media` | Storage providers, FFmpeg, HLS, range streaming |
| `@uiliuili/shared` | Zod contracts, permissions, error codes |
| `@uiliuili/danmaku` | Canvas rendering engine and Bilibili XML conversion |
| `@uiliuili/i18n` | Chinese/English message catalogs |

## Identity and permissions

Roles are the permission source. A persisted `user_group` marker (`USER`,
`CREATOR`, `REVIEWER`, `ADMIN`, `OWNER`) selects the interface and is derived
from roles whenever they change. Reviewers use the review desk, administrators
use the full console, and the owner has every permission.

Installation creates no account. The first registration becomes the owner under
a PostgreSQL advisory lock; a partial unique index allows at most one owner.
When the request does not come from loopback, the registration must present the
installer's one-time claim token, which is stored hashed and deleted once the
owner exists. `owner:promote` is the recovery path.

## Request paths

- Public pages are rendered by Next.js. API calls use same-origin `/api`.
- Uploads go directly to S3 in cloud mode; HLS playback is proxied by the API
  so private and unlisted access checks apply. Public deployments can put a CDN
  in front of the API media route.
- Covers and local media are served by the media controller with HTTP Range.
- Danmaku history is loaded in 6-minute segments. New danmaku is persisted and
  broadcast over Socket.IO.
- Uploads use resumable chunks for local storage and multipart presigned URLs
  for S3.
- Every request resolves a region into an async-local context. Video list
  queries apply the region predicate in SQL, while detail and playback checks
  return HTTP 451 or 404. See [configuration](configuration.md#regions-and-restricted-content).

## Data integrity

- Likes, coins, favorites, follows, and OAuth identities use unique constraints.
- Interaction rows are the source of truth; aggregate counters are updated in the
  same transactions.
- Installer migrations run in a transaction under a PostgreSQL advisory lock.
- First-owner registration and ownership transfer also run under an advisory
  lock, and `users_single_owner_idx` enforces one owner at the database level.
- The installer writes `config/instance.json` last. Without that file the API
  runs in install-only mode.
