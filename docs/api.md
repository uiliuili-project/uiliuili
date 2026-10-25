# API overview

> [简体中文](zh-CN/api.md)

The API is served by NestJS under `/api/v1`. Installer endpoints live under
`/api/install` and are disabled after installation.

## Authentication

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/profile`
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
`group` field (`USER`, `CREATOR`, or `ADMIN`) next to `roles` and `permissions`.
Roles remain the source of truth for permissions; the group only decides which
interface a user enters (creator center or admin console).

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
- `POST /api/v1/studio/videos/:id/upload`
- `PUT /api/v1/studio/uploads/:uploadId/parts/:partNumber`
- `POST /api/v1/studio/uploads/:uploadId/parts/presign`
- `POST /api/v1/studio/uploads/:uploadId/complete`
- `POST /api/v1/studio/videos/:id/publish`
- `PUT /api/v1/studio/videos/:id/cover`

## Social

- `GET /api/v1/feed/home`
- `GET /api/v1/feed/following`
- `GET /api/v1/feed/continue`
- `GET /api/v1/me/history`
- `GET /api/v1/me/favorites`
- `GET /api/v1/me/notifications` (see `/notifications`)
- `POST|DELETE /api/v1/users/:id/follow`
- `GET /api/v1/search`
- `GET /api/v1/search/suggest`
- `GET /api/v1/search/hot`
- `GET|DELETE /api/v1/search/history`

## Admin

All admin routes require the corresponding permission and are listed in
`docs/architecture.md`. Key routes:

- `GET /api/v1/admin/dashboard`
- `GET|PATCH /api/v1/admin/users`
- `GET|PATCH /api/v1/admin/videos`
- `GET|POST /api/v1/admin/danmaku|comments|reports`
- `GET|POST|PATCH|DELETE /api/v1/admin/categories|announcements`
- `GET|PUT /api/v1/admin/settings`
- `POST /api/v1/admin/site/logo` (raw JPEG/PNG/WebP body, max 2 MB)
- `GET /api/v1/admin/system`
- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/audit`

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
