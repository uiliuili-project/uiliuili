# API 概览

> [English](../api.md)

API 由 NestJS 提供，前缀为 `/api/v1`。安装接口位于 `/api/install`，安装完成后会被禁用。

## 鉴权

- `GET /api/v1/auth/csrf`
- `GET /api/v1/auth/setup-status`
- `POST /api/v1/auth/register`（可选 `claimToken`）
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

`GET /api/v1/auth/me` 以及登录、注册响应会在 `roles`、`permissions` 之外返回持久化的 `group` 字段（`USER`、`CREATOR`、`REVIEWER`、`ADMIN` 或 `OWNER`）。权限仍以角色为准；用户组只决定用户进入哪个界面。

`GET /api/v1/auth/setup-status` 返回 `{ needsOwner, claimRequired }`。尚未产生站长时，第一次注册会成为站长；从非本机地址发起的注册必须携带安装器生成的 `claimToken`，回环地址无需填写。

## 地区

- `GET /api/v1/region/options` — 国家/地区清单
- `GET /api/v1/region/context` — 当前请求解析出的地区与限制级策略
- `PATCH /api/v1/auth/preferences` — `{ showRestricted }`；仅当当前地区为无限制地区且已登录时可用

创作中心的创建/更新和管理后台的视频更新都接受 `restricted`、`regionMode`、`regionCodes`、`regionDenyBehavior` 和 `regionDenyMessage`。限制级视频会忽略传入的 `regionCodes`，直接使用站点的 `blockedRegions` 清单。详情与播放接口在地区拒绝时返回 HTTP 451 和错误码 `REGION_RESTRICTED`；视频选择 `not_found` 时返回 404。

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
- `POST /api/v1/admin/owner/transfer`（仅站长；调用者会降为管理员）
- `GET|PUT /api/v1/admin/settings`
- `POST /api/v1/admin/site/logo`（请求体为 JPEG/PNG/WebP 原始字节，最大 2 MB）
- `GET /api/v1/admin/system`
- `GET /api/v1/admin/jobs`
- `GET /api/v1/admin/audit`

## 审核

审核员、管理员与站长使用，每个接口按 `video:review`、`comment:manage`、`report:manage` 分别校验权限：

- `GET /api/v1/review/summary`
- `GET /api/v1/review/videos`
- `POST /api/v1/review/videos/:id/decision`（`approve` 或带原因的 `reject`）
- `GET /api/v1/review/comments`
- `POST /api/v1/review/comments/:id/action`（`hide`、`restore` 或 `delete`）
- `GET /api/v1/review/reports`
- `POST /api/v1/review/reports/:id/handle`

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
