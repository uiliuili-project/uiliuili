# API overview

> [简体中文](zh-CN/api.md)

The API is served by NestJS under `/api/v1`. Installer endpoints live under
`/api/install` and are disabled after installation.

## Service endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Readiness check with `{ ok, version, time }` |
| `GET /health/live` | Lightweight liveness check with `{ ok: true }` |
| `GET /api/docs` | Swagger UI, enabled after installation |

These live at the API root, not under `/api/v1`. The Docker gateway and the
provided Nginx config proxy `/health` directly, so a probe can use the public
origin.

## Authentication

- `GET /api/v1/auth/csrf`
- `GET /api/v1/auth/setup-status`
- `POST /api/v1/auth/register` (accepts optional `claimToken`)
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/profile`
- `PUT /api/v1/auth/cover` (raw JPEG/PNG/WebP body, max 10 MB)
- `DELETE /api/v1/auth/cover`
- `POST /api/v1/auth/password`
- `POST /api/v1/auth/password/forgot`
- `POST /api/v1/auth/password/reset`
- `POST /api/v1/auth/email/verify`
- `GET /api/v1/auth/sessions`
- `DELETE /api/v1/auth/sessions/:id`
- OAuth: `GET /api/v1/auth/oauth/:provider` and `/callback`

Authentication uses HttpOnly access/refresh cookies. Mutating cookie-authenticated
requests require the `x-csrf-token` header matching the `ul_csrf` cookie.

`GET /api/v1/auth/me` and the login/register responses include the persisted
`group` field (`USER`, `CREATOR`, `REVIEWER`, `ADMIN`, or `OWNER`) next to
`roles` and `permissions`. Roles remain the source of truth for permissions;
the group only decides which interface a user enters.

`GET /api/v1/auth/setup-status` reports `{ needsOwner, claimRequired }`. While
no owner exists, the first registration becomes the owner. From a non-loopback
address that request must include the installer's one-time `claimToken`;
loopback registration does not need it.

## Regions

- `GET /api/v1/region/options` — country catalog
- `GET /api/v1/region/context` — resolved region and restricted-content policy
- `PATCH /api/v1/auth/preferences` — `{ showRestricted }`; allowed only when the
  resolved region is unrestricted and the caller is signed in

Studio create/update and admin video update accept `restricted`, `regionMode`,
`regionCodes`, `regionDenyBehavior`, and `regionDenyMessage`. A restricted video
ignores a supplied `regionCodes` and uses the site `blockedRegions` list. Region
denials on detail and playback return HTTP 451 with error code
`REGION_RESTRICTED`, or 404 when the video selects `not_found`.

## Content

- `GET /api/v1/videos`
- `GET /api/v1/videos/:id`
- `GET /api/v1/videos/:id/related`
- `GET /api/v1/videos/:id/playlist`
- `GET /api/v1/videos/:id/hls/*`
- `POST|DELETE /api/v1/videos/:id/like`
- `POST /api/v1/videos/:id/coin`
- `POST|DELETE /api/v1/videos/:id/favorite`
- `POST /api/v1/videos/:id/progress`
- `GET /api/v1/videos/:id/danmaku?segment=0`
- `POST /api/v1/videos/:id/danmaku`
- `GET /api/v1/videos/:id/comments`
- `POST /api/v1/videos/:id/comments`
- `GET /api/v1/categories`
- `GET /api/v1/users/:username/videos`

## Studio

- `GET|POST /api/v1/studio/videos`
- `GET|PATCH|DELETE /api/v1/studio/videos/:id`
- `GET /api/v1/studio/videos/trash`
- `POST /api/v1/studio/videos/:id/restore`
- `DELETE /api/v1/studio/videos/:id/purge`
- `GET /api/v1/studio/videos/:id/history`
- `POST /api/v1/studio/videos/:id/appeals`
- `GET /api/v1/studio/appeals`
- `GET /api/v1/studio/analytics?days=7|30|90`
- `GET /api/v1/studio/comments` and `POST /api/v1/studio/comments/:id/moderate`
- `GET /api/v1/studio/danmaku` and `POST /api/v1/studio/danmaku/:id/moderate`
- `GET|POST /api/v1/studio/collections`
- `PATCH|DELETE /api/v1/studio/collections/:id`
- `GET|POST /api/v1/studio/collections/:id/items` and `DELETE .../items/:videoId`
- `GET|POST /api/v1/studio/articles`
- `GET|PATCH|DELETE /api/v1/studio/articles/:id`
- `POST /api/v1/studio/articles/:id/publish|unpublish`
- `GET /api/v1/studio/fans`, `GET /api/v1/studio/growth`
- `GET /api/v1/studio/collaborations` and `POST /api/v1/studio/collaborations/:videoId/respond`
- `POST|DELETE /api/v1/studio/videos/:id/collaborators[/:userId]`
- `POST /api/v1/studio/videos/:id/upload`
- `PUT /api/v1/studio/uploads/:uploadId/parts/:partNumber`
- `POST /api/v1/studio/uploads/:uploadId/parts/presign`
- `POST /api/v1/studio/uploads/:uploadId/complete`
- `POST /api/v1/studio/videos/:id/publish`
- `PUT /api/v1/studio/videos/:id/cover`

Studio data is isolated by uploader: collaborators get read/edit access only after
accepting an invitation, while destructuring actions such as delete, purge, and
collaborator management stay with the owner. Analytics are anonymous daily
aggregates; individual viewers are never returned, and geography stops at
country level.

## Columns

- `GET /api/v1/articles` and `GET /api/v1/articles/:id` (sanitized HTML body)
- `POST|DELETE /api/v1/articles/:id/like|favorite`
- `GET|POST /api/v1/articles/:id/comments` and `DELETE .../comments/:commentId`


## Social

- `GET /api/v1/feed/home`
- `GET /api/v1/feed/following`
- `GET /api/v1/feed/continue`
- `GET /api/v1/feed/moments` (public image waterfall, cursor paginated)
- `GET /api/v1/me/history`
- `GET /api/v1/me/favorites`
- `GET /api/v1/me/tag-interests`
- `DELETE /api/v1/me/tag-interests`
- `DELETE /api/v1/me/tag-interests/:tagId`
- `POST /api/v1/uploads/images` (raw JPEG/PNG/WebP body, max 10 MB)
- `GET /api/v1/me/notifications` (see `/notifications`)
- `POST|DELETE /api/v1/users/:id/follow`
- `GET /api/v1/search`
- `GET /api/v1/search/suggest`
- `GET /api/v1/search/hot`
- `GET|DELETE /api/v1/search/history`

Comments and dynamics include `ipRegion`, a country-code snapshot resolved from
the request's network region at publish time and hidden when
`privacy.ipLocation` is off. `GET /api/v1/me/tag-interests` returns the learned
tag affinity; the delete routes remove one tag or all of them.

## Admin

All admin routes require the corresponding permission and are listed in
`docs/architecture.md`. Key routes:

- `GET /api/v1/admin/dashboard`
- `GET|PATCH|DELETE /api/v1/admin/users`
- `GET|PATCH /api/v1/admin/videos`
- `GET /api/v1/admin/appeals` and `POST /api/v1/admin/appeals/:id/handle`
- `GET /api/v1/admin/articles` and `POST /api/v1/admin/articles/:id/moderate`
- `GET|POST /api/v1/admin/danmaku|comments|reports`
- `GET|POST|PATCH|DELETE /api/v1/admin/categories|announcements`
- `POST /api/v1/admin/owner/transfer` (owner only; demotes the caller)
- `GET|PUT /api/v1/admin/settings`
- `POST /api/v1/admin/site/logo` (raw JPEG/PNG/WebP body, max 2 MB)
- `GET /api/v1/admin/system`
- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/audit`

## Review

Routes for reviewers, administrators, and the owner. Each endpoint enforces
its own permission (`video:review`, `comment:manage`, or `report:manage`):

- `GET /api/v1/review/summary`
- `GET /api/v1/review/videos`
- `POST /api/v1/review/videos/:id/decision` (`approve` or `reject` with a reason)
- `GET /api/v1/review/comments`
- `POST /api/v1/review/comments/:id/action` (`hide`, `restore`, or `delete`)
- `GET /api/v1/review/reports`
- `POST /api/v1/review/reports/:id/handle`

## WebSocket

Socket.IO namespace `/danmaku`:

```text
join   { videoId }
leave
send   { videoId, progressMs, mode, color, fontSize, content }
danmaku { videoId, item }
blocked { message }
viewers { videoId, count }
```
