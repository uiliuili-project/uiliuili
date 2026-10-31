# 架构

> [English](../architecture.md)

uiliuili 采用模块化单体架构，并将任务处理拆分为独立的 worker 进程。

```text
浏览器
  │
Nginx ── Next.js 公开站
  │    ├─ 管理后台 SPA
  │    └─ /api ── NestJS API
  │                   ├─ PostgreSQL（业务数据 + 任务队列）
  │                   ├─ 可选 Redis（缓存、限流、发布/订阅）
  │                   ├─ 可选 Meilisearch
  │                   └─ 本地磁盘 / S3
  │
Worker ── FFmpeg ── HLS ── 存储
```

硬性依赖为 Node.js 22+、PostgreSQL 16+ 和 FFmpeg 6+（推荐 7）。Redis 与 Meilisearch
为可选项。未启用 Redis 时，API 以单机模式运行，缓存、限流与 WebSocket
广播都在进程内存中完成。任务保存在 PostgreSQL 中，通过
`FOR UPDATE SKIP LOCKED` 领取，因此 worker 可以独立横向扩容。

## 应用

| 应用 | 职责 |
| --- | --- |
| `apps/api` | REST API、鉴权、安装接口、WebSocket 网关 |
| `apps/worker` | 转码、封面生成、搜索索引、推荐计算、清理任务 |
| `apps/web` | Next.js 公开站 |
| `apps/admin` | React 管理后台与安装向导 |
| `apps/cli` | 无界面安装与运维命令 |
| `apps/video-node` | 可选的外部视频节点：独立主机上的上传、转码与播放服务 |

## 包

| 包 | 职责 |
| --- | --- |
| `@uiliuili/db` | Drizzle schema、SQL 迁移、种子数据 |
| `@uiliuili/installer` | 安装校验、配置生成、迁移执行器 |
| `@uiliuili/media` | 存储驱动、FFmpeg、HLS、Range 流式传输 |
| `@uiliuili/shared` | Zod 契约、权限、错误码 |
| `@uiliuili/danmaku` | Canvas 渲染引擎与 Bilibili XML 转换 |
| `@uiliuili/i18n` | 中文/英文语言包 |
| `@uiliuili/video-node-contract` | 主站与视频节点之间的 HMAC 签名与请求/响应 schema |

## 外部视频节点

视频节点是可选的横向扩展方式：把上传接收和 FFmpeg 转码放到离用户更近或
CPU 更充足的机器上，主站只负责鉴权、路由和元数据。

- 节点通过 `VIDEO_NODE_*` 环境变量配置：监听端口、公开地址、区域、数据库、
  共享密钥、存储目录、转码并发、最大分辨率与上传大小。
- 主站与节点之间使用 `@uiliuili/video-node-contract` 的 HMAC 签名请求，
  带时间戳与 nonce，防止重放。
- 管理后台的**视频节点**页面负责添加节点、测试连通性、设置上传路由策略
  （`load`、`fixed`、`region`）以及管理资产复制任务。
- 默认关闭（`videoNodes.enabled=false`）。单机部署不需要它；启用前请确认
  节点与主站之间的网络、时钟和密钥一致。

## 身份与权限

角色是权限的唯一来源。用户记录保存 `user_group` 标记（`USER`、`CREATOR`、`REVIEWER`、`ADMIN`、`OWNER`），用于选择界面，并在角色变化时重新计算。审核员使用审核台，管理员使用完整管理后台，站长拥有全部权限。

安装过程不创建账号。第一次注册会在 PostgreSQL advisory lock 保护下成为站长；部分唯一索引保证最多只有一个站长。请求不是来自回环地址时，注册必须携带安装器生成的一次性认领码；认领码只保存哈希，站长产生后立即删除。`owner:promote` 是恢复入口。

## 请求链路

- 公开页面由 Next.js 渲染，API 调用使用同源 `/api`。
- 云存储模式下，上传通过预签名 URL 直传 S3；HLS 播放由 API 代理，以便执行私有和未列出视频的访问检查。公开部署可以在 API 媒体路由前加 CDN。
- 封面与本地媒体由媒体控制器通过 HTTP Range 提供。
- 弹幕历史按 6 分钟分片加载。新弹幕写入数据库后通过 Socket.IO 广播。
- 本地存储使用分片断点续传，S3 使用分片预签名直传。
- 每个请求都会解析地区并写入异步上下文。视频列表查询在 SQL 层应用地区条件；详情与播放检查返回 HTTP 451 或 404。详见[配置](configuration.md#地区与限制级内容)。

## 数据完整性

- 点赞、投币、收藏、关注和 OAuth 身份均使用唯一约束。
- 交互明细表是唯一事实来源；聚合计数在同一个事务中更新。
- 安装迁移在 PostgreSQL advisory lock 保护下以事务执行。
- 安装器最后写入 `config/instance.json`；该文件不存在时，API 只运行安装模式。
- 首位站长注册与站长转移同样在 advisory lock 下执行，并由 `users_single_owner_idx` 在数据库层保证唯一。
