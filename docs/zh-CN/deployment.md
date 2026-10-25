# 原生部署

> [English](../deployment.md)

uiliuili 运行时不依赖 Docker。典型部署包括：

- Node.js 22
- PostgreSQL 16+
- FFmpeg 7+
- 可选的 Redis 与 Meilisearch
- Nginx
- systemd

想用容器部署？见 [Docker 部署](docker.md)。

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

以上是规划参考，不是基准测试结果。2 核 4 GB 的 VPS 足以体验 uiliuili，
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

建议使用 64 位 Linux（Ubuntu 24.04 LTS 或 Debian 12）、XFS 或 ext4
文件系统，并配置 2–4 GB swap 作为 OOM 保护。swap 不能替代转码所需的内存。

## 目录结构

```text
/opt/uiliuili/          应用目录
/opt/uiliuili/.env      由安装器生成
/opt/uiliuili/config/   实例标记
/opt/uiliuili/storage/  本地上传与临时文件
```

创建专用服务用户：

```bash
sudo useradd --system --home /opt/uiliuili --shell /usr/sbin/nologin uiliuili
sudo chown -R uiliuili:uiliuili /opt/uiliuili
```

## 构建

```bash
cd /opt/uiliuili
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

## Nginx

将 `infra/nginx/uiliuili.conf` 复制到
`/etc/nginx/sites-available/uiliuili`，调整安装路径，启用站点并重载 Nginx：

```bash
sudo ln -s /etc/nginx/sites-available/uiliuili /etc/nginx/sites-enabled/uiliuili
sudo nginx -t
sudo systemctl reload nginx
```

管理后台 SPA 由 `/admin/` 提供，Next.js 站点位于 `/`，API、媒体和
WebSocket 流量代理到 API 服务。

## systemd

将 `infra/systemd/*.service` 复制到 `/etc/systemd/system/`，然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now uiliuili-api uiliuili-worker uiliuili-web
```

当安装器以退出码 75 结束时，API 单元会自动重启。

在 Nginx 之后运行时，请在 `.env` 中设置 `TRUST_PROXY=true`，以便限流和安装器安全逻辑正确解析客户端 IP。API 直接暴露在公网时不要启用该选项。

## 首次安装

打开 `https://your-domain/admin/install`。API 控制台会打印一次性安装令牌。安装完成后 API 会重启，安装器随即关闭。

无界面安装：

```bash
pnpm cli install --config install.json
```

## 开发

终端 1：

```bash
pnpm --filter @uiliuili/api dev
pnpm --filter @uiliuili/worker dev
```

终端 2：

```bash
pnpm --filter @uiliuili/web dev
pnpm --filter @uiliuili/admin dev
```

开发环境中，如果 web 与 API 使用不同端口，请以
`NEXT_PUBLIC_API_URL=http://127.0.0.1:3001` 启动 Next.js。

## 扩容

- 多个 API 实例必须启用 Redis，以共享缓存、限流和 Socket.IO 广播。
- 多个 worker 可以共用同一个 PostgreSQL 队列，任务通过 `FOR UPDATE SKIP LOCKED` 领取。
- API 与 worker 不在同一台机器上时，应使用 S3 存储。
- 条件允许时，在公开媒体前加 CDN。
