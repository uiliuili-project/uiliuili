# API 概览

> [English](../api.md)

API 由 NestJS 提供，前缀为 `/api/v1`。安装接口位于 `/api/install`，安装完成后会被禁用。

## 服务端点

| 端点 | 用途 |
| --- | --- |
| `GET /health` | 就绪检查，返回 `{ ok, version, time }` |
| `GET /health/live` | 轻量存活检查，返回 `{ ok: true }` |
| `GET /api/docs` | Swagger UI，安装完成后启用 |

这些端点位于 API 根路径，不在 `/api/v1` 下。Docker 网关和仓库提供的 Nginx 配置
都会把 `/health` 精确反代到 API，因此探针可以直接使用公开地址。

## 鉴权

- `GET /api/v1/auth/csrf`
- `GET /api/v1/auth/setup-status`
- `POST /api/v1/auth/register`（可选 `claimToken`）
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/profile`
- `PUT /api/v1/auth/cover`（原始 JPEG/PNG/WebP 请求体，最大 10 MB）
- `DELETE /api/v1/auth/cover`
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
- `GET /api/v1/studio/videos/trash`
- `POST /api/v1/studio/videos/:id/restore`
- `DELETE /api/v1/studio/videos/:id/purge`
- `GET /api/v1/studio/videos/:id/history`
- `POST /api/v1/studio/videos/:id/appeals`
- `GET /api/v1/studio/appeals`
- `GET /api/v1/studio/analytics?days=7|30|90`
- `GET /api/v1/studio/comments` 与 `POST /api/v1/studio/comments/:id/moderate`
- `GET /api/v1/studio/danmaku` 与 `POST /api/v1/studio/danmaku/:id/moderate`
- `GET|POST /api/v1/studio/collections`
- `PATCH|DELETE /api/v1/studio/collections/:id`
- `GET|POST /api/v1/studio/collections/:id/items` 与 `DELETE .../items/:videoId`
- `GET|POST /api/v1/studio/articles`
- `GET|PATCH|DELETE /api/v1/studio/articles/:id`
- `POST /api/v1/studio/articles/:id/publish|unpublish`
- `GET /api/v1/studio/fans`、`GET /api/v1/studio/growth`
- `GET /api/v1/studio/collaborations` 与 `POST /api/v1/studio/collaborations/:videoId/respond`
- `POST|DELETE /api/v1/studio/videos/:id/collaborators[/:userId]`
- `POST /api/v1/studio/videos/:id/upload`
- `PUT /api/v1/studio/uploads/:uploadId/parts/:partNumber`
- `POST /api/v1/studio/uploads/:uploadId/parts/presign`
- `POST /api/v1/studio/uploads/:uploadId/complete`
- `POST /api/v1/studio/videos/:id/publish`
- `PUT /api/v1/studio/videos/:id/cover`

创作数据按投稿人隔离：联合投稿成员接受邀请后才能读写，删除、彻底删除、成员管理等破坏性操作仍仅限投稿人。数据面板只返回匿名每日聚合，不包含单个观众信息，地区只到国家。

## 专栏

- `GET /api/v1/articles` 与 `GET /api/v1/articles/:id`（正文为已过滤的 HTML）
- `POST|DELETE /api/v1/articles/:id/like|favorite`
- `GET|POST /api/v1/articles/:id/comments` 与 `DELETE .../comments/:commentId`


## 社交

- `GET /api/v1/feed/home`
- `GET /api/v1/feed/following`
- `GET /api/v1/feed/continue`
- `GET /api/v1/feed/moments`（公开图文瀑布流，游标分页）
- `GET /api/v1/me/history`
- `GET /api/v1/me/favorites`
- `GET /api/v1/me/tag-interests`
- `DELETE /api/v1/me/tag-interests`
- `DELETE /api/v1/me/tag-interests/:tagId`
- `POST /api/v1/uploads/images`（原始 JPEG/PNG/WebP 请求体，最大 10 MB）
- `GET /api/v1/me/notifications`（另见 `/notifications`）
- `POST|DELETE /api/v1/users/:id/follow`
- `GET /api/v1/search`
- `GET /api/v1/search/suggest`
- `GET /api/v1/search/hot`
- `GET|DELETE /api/v1/search/history`

评论和动态会返回 `ipRegion`，它是发布时按网络地区解析出的国家代码快照；关闭 `privacy.ipLocation` 后不再返回。`GET /api/v1/me/tag-interests` 返回已学到的标签兴趣，两个删除接口分别移除单个标签和全部标签。

## 管理后台

所有管理接口都要求相应权限，完整清单见[架构](architecture.md)。主要路由：

- `GET /api/v1/admin/dashboard`
- `GET|PATCH|DELETE /api/v1/admin/users`
- `GET|PATCH /api/v1/admin/videos`
- `GET /api/v1/admin/appeals` 与 `POST /api/v1/admin/appeals/:id/handle`
- `GET /api/v1/admin/articles` 与 `POST /api/v1/admin/articles/:id/moderate`
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
