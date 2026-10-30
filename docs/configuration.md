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

## Regions and restricted content

Regions use ISO 3166-1 alpha-2 country codes only; there is no sub-country
granularity. Every request resolves a region from:

1. the signed-in account's stored region, recorded automatically at
   registration and never editable by the user;
2. the configured country header (`cf-ipcountry` by default), normally supplied
   by a reverse proxy or CDN;
3. an optional MaxMind `.mmdb` database, used when the `maxmind` package is
   installed;
4. the configured fallback region.

Administrators may correct an account's region from **Users**; the correction is
recorded with `regionSource = 'admin'`.

Two settings groups control the feature:

| Group | Fields | Purpose |
| --- | --- | --- |
| `region` | `fallback`, `header`, `geoipDatabase` | How the country is resolved |
| `restricted` | `blockedRegions`, `defaultBehavior`, `defaultMessage` | Which countries may publish or play restricted content, and how denial is presented |

`blockedRegions` is the authoritative list. A video marked as restricted is
always stored with `regionMode = 'block'` and a copy of that list; saving the
setting refreshes the stored policy of every restricted video. All other
countries are unrestricted.

In unrestricted countries each user has a personal **Show restricted content**
preference, off by default. Restricted content always requires a signed-in
account; anonymous detail requests receive a login-required 451 response. Staff
with `video:review` or `video:manage_any`, and the uploader, bypass region checks
for moderation and preview.

Normal videos may also set `regionMode = 'block'` with their own `regionCodes`
list. Denials use the site default or a per-video `regionDenyBehavior`
(`message` or `not_found`) and message. List endpoints filter blocked videos in
SQL; detail and playback endpoints return HTTP 451 with error code
`REGION_RESTRICTED`, or 404 when the video opts into `not_found`.

## IP location display

Comments and dynamics store a country-code snapshot (`ip_region`) taken when
they are published. It is resolved from the request's network region, which is
deliberately separate from the account-based region used for access control:

1. the configured country header (`cf-ipcountry` by default);
2. the optional MaxMind `.mmdb` database, when installed;
3. the signed-in account's stored region;
4. the configured fallback region.

Only the ISO 3166-1 alpha-2 code is stored. Raw IP addresses and sub-country
regions are never persisted, and existing rows are not backfilled, so content
published before the feature was enabled shows no label.

The `privacy.ipLocation` setting (default on, **Settings → Regions**) controls
display. When it is off the API omits `ipRegion` from comments and dynamics and
`lastRegion` from profiles without deleting the stored values; turning it back
on restores the labels. Personal spaces show the account's most recently
observed network region (`users.lastRegion`), refreshed on authenticated
requests and only used for display.

## Space covers and image uploads

Members may upload a public-space cover in **Settings → Profile**. The browser
centre-crops it to 1920×480 (4:1) and re-encodes it as WebP (JPEG fallback)
before upload, so stored files stay small. Endpoints:

- `PUT /api/v1/auth/cover` — raw JPEG, PNG, or WebP body, at most 10 MB;
- `DELETE /api/v1/auth/cover` — removes the stored cover file.

Image posts upload each image through `POST /api/v1/uploads/images` (raw body,
at most 10 MB, up to nine per post, 60 uploads per user per hour). The shared
uploader validates magic bytes instead of trusting the declared content type;
SVG and other formats are rejected. The returned URL is what a dynamic stores.

## Moments feed

The home page carries a video/image-posts switch. `/?mode=moments` renders an
image waterfall assembled from public dynamics that contain at least one image;
banned authors and authors blocked by the viewer are excluded. It stays a query
mode on the home route rather than a separate page, so existing links and
sharing keep working. API: `GET /api/v1/feed/moments?limit=&cursor=` (public,
cursor paginated).

## Tag affinity recommendations

When enabled, the platform learns tag interests from recent watch history:

- Saving watch progress adds every tag of the watched video with a depth weight
  (`0.2 + 0.8 × watched fraction`, plus `0.5` on completion, capped at 5).
- Learning happens at most once every ten minutes per video, or immediately when
  the video is completed; `watch_histories.tag_synced_at` records the last sync.
- Every new hit decays the existing score by `× 0.9` before adding, so recent
  interests dominate. A daily worker job (`tag-decay`) multiplies all scores by
  `decayPerDay` and deletes anything below `0.05`.

The `recommendation.tagAffinity` settings group controls the feature:

| Field | Default | Purpose |
| --- | --- | --- |
| `enabled` | `true` | Learn tag affinity and use it in recommendations |
| `weight` | `0.6` | Ranking-SQL boost for videos matching interest tags |
| `ratio` | `0.35` | Share of the 12-slot home feed filled from interest-tag pools (capped at 0.8) |
| `decayPerDay` | `0.95` | Daily decay factor applied by the worker |
| `maxTags` | `8` | Number of strongest tags kept and used |

Users can review, remove, or clear learned tags in **Settings → Recommendation
preferences** (`GET /api/v1/me/tag-interests`, `DELETE
/api/v1/me/tag-interests`, `DELETE /api/v1/me/tag-interests/:tagId`). Interests
are private and never shown on a profile. Without learned tags, or with the
feature disabled, the home feed falls back to the existing category and
exploration blend.

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

