# API 概览

> [English](../api.md)

API 由 NestJS 提供，前缀为 `/api/v1`。安装接口位于 `/api/install`，安装完成后会被禁用。

## 鉴权

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
- OAuth：`GET /api/v1/auth/oauth/:provider` 与 `/callback`

鉴权使用 HttpOnly 的 access/refresh Cookie。使用 Cookie 鉴权的写请求必须携带与 `ul_csrf` Cookie 匹配的 `x-csrf-token` 请求头。

`GET /api/v1/auth/me` 以及登录、注册响应会在 `roles`、`permissions` 之外返回持久化的 `group` 字段（`USER`、`CREATOR` 或 `ADMIN`）。权限仍以角色为准；用户组只决定用户进入创作中心还是管理后台。

## 内容

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

## 创作中心

- `GET|POST /api/v1/studio/videos`
- `GET|PATCH|DELETE /api/v1/studio/videos/:id`
- `POST /api/v1/studio/videos/:id/upload`
- `PUT /api/v1/studio/uploads/:uploadId/parts/:partNumber`
- `POST /api/v1/studio/uploads/:uploadId/parts/presign`
- `POST /api/v1/studio/uploads/:uploadId/complete`
- `POST /api/v1/studio/videos/:id/publish`
- `PUT /api/v1/studio/videos/:id/cover`

## 社交

- `GET /api/v1/feed/home`
- `GET /api/v1/feed/following`
- `GET /api/v1/feed/continue`
- `GET /api/v1/me/history`
- `GET /api/v1/me/favorites`
- `GET /api/v1/me/notifications`（另见 `/notifications`）
- `POST|DELETE /api/v1/users/:id/follow`
- `GET /api/v1/search`
- `GET /api/v1/search/suggest`
- `GET /api/v1/search/hot`
- `GET|DELETE /api/v1/search/history`

## 管理后台

所有管理接口都要求相应权限，完整清单见[架构](architecture.md)。主要路由：

- `GET /api/v1/admin/dashboard`
- `GET|PATCH /api/v1/admin/users`
- `GET|PATCH /api/v1/admin/videos`
- `GET|POST /api/v1/admin/danmaku|comments|reports`
- `GET|POST|PATCH|DELETE /api/v1/admin/categories|announcements`
- `GET|PUT /api/v1/admin/settings`
- `POST /api/v1/admin/site/logo`（请求体为 JPEG/PNG/WebP 原始字节，最大 2 MB）
- `GET /api/v1/admin/system`
- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/audit`

## WebSocket

Socket.IO 命名空间 `/danmaku`：

```text
join   { videoId }
leave
send   { videoId, progressMs, mode, color, fontSize, content }
danmaku { videoId, item }
blocked { message }
viewers { videoId, count }
```
