# 原生部署

> [English](../deployment.md)

原生部署不依赖 Docker，典型环境：

- Node.js 22
- PostgreSQL 16+
- FFmpeg 6+（推荐 7）
- 可选的 Redis 与 Meilisearch
- Nginx
- systemd

只想最快跑起来？使用 [Docker 部署](docker.md)。首次安装的完整步骤见[安装 · 原生安装](installation.md#原生安装)，本文重点讲生产配置。

## 服务器推荐配置

容量主要由三类负载决定：FFmpeg 转码（CPU）、并发播放（带宽）、API 与
PostgreSQL（内存和磁盘 IOPS）。下表是 1080p 以内 H.264 源片的起步建议；
确定规格前，请用自己的片源做一次压力测试。

| 场景 | vCPU | 内存 | 系统盘 | 数据盘 | 带宽 | `TRANSCODE_CONCURRENCY` |
| --- | --- | --- | --- | --- | --- | --- |
| 开发 / 试用 | 2 | 4 GB | 40 GB SSD | — | — | 1 |
| 个人实例或小团队 | 2–4 | 4–8 GB | 40–60 GB SSD | 200 GB 以上 | 10 Mbps | 1 |
| 小型社区 | 4–8 | 8–16 GB | 60–100 GB SSD | 500 GB–1 TB | 50–100 Mbps | 2 |
| 中型社区 | 8–16 | 16–32 GB | 100 GB SSD | 2–4 TB NVMe | 200 Mbps–1 Gbps | 3–4 |

大型部署建议按角色拆分，而不是单纯买一台更大的机器：

- 2 个以上 API 节点，每个 4–8 vCPU、8–16 GB 内存，置于 Nginx 之后；此模式必须启用 Redis。
- 1–4 个 worker 节点，每个 16 vCPU、32 GB 内存，并配备 NVMe 临时盘。
- PostgreSQL 独立部署：8–16 vCPU、32–64 GB 内存、NVMe，并配置只读副本用于备份和故障切换。
- Redis 2–8 GB；Meilisearch 4–8 vCPU、8–16 GB 内存；媒体文件放在 S3 并前置 CDN。

以上是规划参考，不是基准测试结果。2 核 4 GB 的 VPS 足以体验萌悠，
但当多个 1080p 上传和数百名观众同时出现时就会明显吃力。

### 容量与转码并发

- 每个视频按清晰度逐档转码（360p、480p、720p、1080p），一个任务会从头到尾占用一个 worker 槽位。
- libx264 在 `veryfast` 预设下，单个 1080p 档位大约占用 2–3 vCPU，720p 档位约 1–2 vCPU。`TRANSCODE_CONCURRENCY` 建议设为核数的约三分之一（1080p）或二分之一（720p），并留出 1–2 核给 API、PostgreSQL 和系统。
- 提高并发只能缩短排队时间；CPU 饱和后吞吐不会增加，只会让每个任务都变慢。需要更高吞吐时应横向增加 worker。
- 小机器上建议通过上传设置的最大分辨率（`maxResolution`）限制到 720p，可把 CPU 时间和输出体积大约减半。
- 每个 FFmpeg 任务约占 300–600 MB 内存，另加每个进程的 Node.js 开销。

### 存储与带宽估算

- 1080p 档位组合（360p + 480p + 720p + 1080p）每小时源视频约产生 4–5 GB HLS 文件；仅 720p 档位组合约 2–3 GB。
- 如果需要重新转码，请保留原始上传文件，并额外预留 30% 空间和备份空间。1 TB 数据盘大约可存放 100–150 小时的 1080p 内容（含原始文件）。
- 带宽需求 = 同时观看人数 × 实际播放码率。100 人观看 720p（约 2.8 Mbps）约需 280 Mbps。持续出网超过约 100 Mbps 时，建议在媒体前加 CDN。
- PostgreSQL 需要较快的随机 IO，请使用 NVMe 或配置 IOPS，并将 `shared_buffers` 设为内存的约 25%。约 1000 日活以内单台小实例足够；1 万日活建议 4–8 vCPU、16 GB 内存。
- Redis 通常占用不到 1 GB。Meilisearch 大致需要与索引文本相当的内存，10 万视频常见为 2–4 GB。

建议使用 64 位 Linux，**Ubuntu 24.04 LTS 或 Debian 13**，XFS 或 ext4 文件系统，
并配置 2–4 GB swap 作为 OOM 保护。swap 不能替代转码所需的内存。

Debian 12 也可运行，但自带 FFmpeg 与 PostgreSQL 版本偏旧：PostgreSQL 16 需从
[PGDG](https://www.postgresql.org/download/linux/debian/) 安装，FFmpeg 建议从
backports 获取。Ubuntu 24.04 自带 FFmpeg 6.1，满足最低要求。

## 目录与用户

```text
/opt/uiliuili/          应用目录
/opt/uiliuili/.env      由安装器或手工创建
/opt/uiliuili/config/   实例标记
/opt/uiliuili/storage/  本地上传与临时文件
```

创建专用服务用户，并确保配置与存储目录可写：

```bash
sudo useradd --system --home /opt/uiliuili --shell /usr/sbin/nologin uiliuili
sudo chown -R uiliuili:uiliuili /opt/uiliuili
sudo chmod 600 /opt/uiliuili/.env
```

服务用户需要对 `config/`、`storage/` 和 `.env` 有读写权限；Nginx 需要对
`apps/admin/dist` 有读权限。

## 构建

```bash
cd /opt/uiliuili
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

如果以其他用户构建，构建完成后重新执行上面的 `chown`，避免服务用户无法写入
`storage/`。

构建产物：

| 应用 | 产物 |
| --- | --- |
| API | `apps/api/dist/main.js` |
| worker | `apps/worker/dist/main.js` |
| 公开站 | `apps/web/.next`，由 Next.js 启动 |
| 管理后台 | `apps/admin/dist`，由 Nginx 直接提供 |
| CLI | `apps/cli/dist/index.js` |

## Nginx

将 `infra/nginx/uiliuili.conf` 复制到
`/etc/nginx/sites-available/uiliuili`，按实际安装路径调整 `root` 与
`alias`，启用站点并重载：

```bash
sudo cp infra/nginx/uiliuili.conf /etc/nginx/sites-available/uiliuili
sudo ln -s /etc/nginx/sites-available/uiliuili /etc/nginx/sites-enabled/uiliuili
sudo nginx -t
sudo systemctl reload nginx
```

配置要点：

- `/admin/` 直接读取 `apps/admin/dist` 静态文件，不走 Next.js。
- `/api/`、`/media/`、`/socket.io/` 反代到 API（默认 `127.0.0.1:3001`）。
- `/health` 精确反代到 API，供探针和负载均衡使用。
- `/api/install/` 关闭 `proxy_request_buffering`，避免安装请求被缓冲。
- 上传体积由 `client_max_body_size` 控制，默认 2 GB。

生产环境务必启用 HTTPS。Let's Encrypt 示例：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d video.example.com
```

然后把 `.env` 中的 `APP_URL` 改为 `https://video.example.com` 并重启 API。

在 Nginx 之后运行时，请在 `.env` 中设置 `TRUST_PROXY=true`，以便限流、地区和
安装器安全逻辑正确解析客户端 IP。API 直接暴露在公网时不要启用该选项。

## systemd

将 `infra/systemd/*.service` 复制到 `/etc/systemd/system/`，然后：

```bash
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uiliuili-api uiliuili-worker uiliuili-web
```

三个单元都直接调用 `node`，不依赖全局 pnpm：

- `uiliuili-api`：`apps/api/dist/main.js`
- `uiliuili-worker`：`apps/worker/dist/main.js`
- `uiliuili-web`：从 `apps/web` 启动 Next.js

当安装器以退出码 75 结束时，API 单元会自动重启进入完整模式。查看状态与日志：

```bash
systemctl status uiliuili-api uiliuili-worker uiliuili-web
journalctl -u uiliuili-api -f
journalctl -u uiliuili-worker -f
```

如果修改了安装目录，请同步编辑单元文件中的 `WorkingDirectory`、`EnvironmentFile`
和 `ExecStart`。

## 首次安装

安装令牌与站长认领码的完整流程见[安装 · 原生安装](installation.md#原生安装)。生产环境推荐：

```bash
pnpm cli doctor
pnpm cli install --from-env
```

或在 API 启动后打开 `https://your-domain/admin/install` 使用网页安装器。安装完成后
API 会重启，安装接口永久关闭。

## 安装后检查

- `curl -i https://your-domain/health` 返回 `200`；
- 管理后台可以登录，第一个账号是站长；
- 上传一个视频，转码完成且可以播放；
- worker 日志没有重复失败；
- 数据库没有待执行迁移（`pnpm cli status`）；
- `/etc/nginx` 与 `.env` 中的路径、域名、端口一致。

## 扩容

- 多个 API 实例必须启用 Redis，以共享缓存、限流和 Socket.IO 广播。
- 多个 worker 可以共用同一个 PostgreSQL 队列，任务通过 `FOR UPDATE SKIP LOCKED` 领取。
- API 与 worker 不在同一台机器上时，应使用 S3 存储。
- 条件允许时，在公开媒体前加 CDN。
- 管理后台是静态文件，可以在多台 Nginx 上各放一份 `apps/admin/dist`。

## 开发环境

本地开发、测试和目录结构见[开发指南](development.md)。生产服务器上不要运行
`pnpm dev`。
