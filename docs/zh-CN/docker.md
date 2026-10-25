# Docker 部署

> [English](../docker.md)

Docker 是**额外的部署方式**。原生 Node.js + systemd 部署继续完整支持；如果你希望应用直接运行在宿主机上，仍然优先选择原生方式。

Compose 会启动一套完整环境：

| 服务 | 作用 |
| --- | --- |
| `gateway` | Nginx，监听 8080：提供 `/admin/`，反代 `/api`、`/media`、`/socket.io` 与公开站 |
| `web` | Next.js standalone 服务 |
| `api` | NestJS API 与安装接口 |
| `worker` | FFmpeg 转码、搜索索引、推荐、清理 |
| `bootstrap` | 一次性安装/迁移容器，先于 API 启动 |
| `postgres` | PostgreSQL 16（业务 schema `uiliuili`） |
| `redis` | 代码中为可选，这里默认启用，用于缓存与 Socket.IO 广播 |

上传源文件、HLS、封面、`.env` 与 `config/instance.json` 都保存在
`app-data` 卷的 `/data` 目录；PostgreSQL 和 Redis 各自使用独立卷。

## 环境要求

- Docker Engine + Compose v2
- 试用建议 2 vCPU / 4 GB 内存；转码容量参考[原生部署](deployment.md#服务器推荐配置)
- 20 GB 以上可用磁盘（镜像与首批上传）
- 应用镜像已内置 FFmpeg 7

## 快速开始

```bash
cp docker/.env.example .env
```

至少修改以下变量：

- `APP_URL`：对外访问地址，例如 `http://server.example.com:8080`
- `APP_KEY`：`openssl rand -hex 32`
- `DB_PASSWORD`：URL 安全密码，例如
  `openssl rand -base64 24 | tr '+/' '-_' | tr -d '='`
- `ADMIN_PASSWORD`：至少 10 位，包含字母和数字

然后启动：

```bash
docker compose up -d --build
docker compose logs -f bootstrap
```

首次运行会创建表结构、管理员账号，并写入 `/data/.env` 与
`/data/config/instance.json`。之后再次执行同一条命令只会应用待执行的迁移，因此它也是升级入口。

访问：

- 站点：`http://server.example.com:8080`
- 管理后台：`http://server.example.com:8080/admin/`
- 健康检查：`http://server.example.com:8080/health`

使用 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD` 登录，并在首次登录后修改密码。

### 修改端口

同时修改 `GATEWAY_PORT` 与 `APP_URL`：

```dotenv
GATEWAY_PORT=9090
APP_URL=http://server.example.com:9090
```

只有 gateway 会映射宿主机端口；PostgreSQL、Redis、API、worker 与 web 都只在 Compose 内部网络中通信。

## 配置

Compose 在创建容器时读取 `.env`。常用变量：

| 变量 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `COMPOSE_PROJECT_NAME` | 否 | `uiliuili` | 容器与卷名前缀 |
| `GATEWAY_PORT` | 否 | `8080` | 宿主机映射端口 |
| `APP_URL` | 是 | `http://localhost:8080` | 对外地址，也用于 CORS 与链接 |
| `APP_KEY` | 是 | — | 64 位十六进制，用于加密设置中的密钥 |
| `DB_USER` / `DB_NAME` | 否 | `uiliuili` | PostgreSQL 账号与库名 |
| `DB_PASSWORD` | 是 | — | 必须 URL 安全，因为会拼进 `DATABASE_URL` |
| `DB_SCHEMA` | 否 | `uiliuili` | 业务 schema |
| `REDIS_URL` | 否 | `redis://redis:6379` | 留空则使用单机内存模式 |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 首次安装 | — | `bootstrap` 创建的管理员 |
| `SITE_NAME` / `SITE_DESCRIPTION` | 否 | `uiliuili` | 站点信息 |
| `SITE_LOCALE` / `SITE_TIMEZONE` / `SITE_REGISTRATION` | 否 | `zh-CN` / `Asia/Shanghai` / `open` | 初始站点设置 |
| `STORAGE_DRIVER` | 否 | `local` | 首次安装可选 `local` 或 `s3` |
| `TRANSCODE_CONCURRENCY` | 否 | `2` | 每个 worker 的并发转码数 |
| `MEILISEARCH_URL` / `MEILISEARCH_KEY` | 否 | — | 启用 Meilisearch，否则使用 PostgreSQL 搜索 |

`docker/.env.example` 还列出了无人值守安装支持的 `S3_*` 与 `MAIL_*` 变量。这些值只在创建新实例时读取；安装完成后请在管理后台修改。**安装后不要更换 `APP_KEY`**，否则已加密的设置将无法解密，请一并备份。

### 使用外部数据库或 Redis

删除或覆盖 `postgres`、`redis` 服务，把 `DATABASE_URL` / `REDIS_URL` 指向外部实例即可。多节点部署时，把 `api` 与 `worker` 分到不同主机、启用 Redis，并把媒体迁移到 S3；也可以用现有反向代理替代 gateway。

## 日常运维

```bash
docker compose ps
docker compose logs -f api worker
docker compose restart api
docker compose exec postgres psql -U uiliuili -d uiliuili
```

在容器内执行 CLI：

```bash
docker compose run --rm bootstrap node dist/index.js status
docker compose run --rm bootstrap node dist/index.js doctor
docker compose run --rm bootstrap node dist/index.js admin:create
```

`bootstrap` 是容器入口：`/data/config/instance.json` 不存在时执行安装，存在时执行迁移。它失败时 API 与 worker 不会启动，避免半安装实例对外服务。

### 升级

先备份，再重建并重启：

```bash
docker compose build
docker compose up -d
docker compose logs -f bootstrap
```

代码和依赖都在镜像里，持久数据只在 `/data` 与数据库中，因此重建镜像不会影响用户数据。

### 备份与恢复

数据库：

```bash
docker compose exec -T postgres pg_dump -U uiliuili -d uiliuili -Fc > uiliuili.dump
docker compose exec -T postgres pg_restore -U uiliuili -d uiliuili --clean --if-exists < uiliuili.dump
```

应用数据（上传、HLS、`.env`、安装标记）：

```bash
docker run --rm -v uiliuili_app-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/app-data.tar.gz -C /data .
docker run --rm -v uiliuili_app-data:/data -v "$PWD":/backup alpine \
  tar xzf /backup/app-data.tar.gz -C /data
```

如果修改过 `COMPOSE_PROJECT_NAME`，请用 `docker volume ls` 确认实际卷名。数据库与 `app-data` 必须一起备份：数据库中的媒体 key 指向该卷里的文件。

### 重置

```bash
# 仅移除安装标记，保留数据库：
docker compose run --rm bootstrap node dist/index.js reset --force

# 删除全部数据（上传、数据库、Redis）：
docker compose down -v
```

`down -v` 不可恢复，也没有二次确认。

## TLS 与反向代理

gateway 只监听 HTTP，请在前置 Caddy、Traefik 或另一层 Nginx 上终止 TLS：

```nginx
server {
  listen 443 ssl;
  server_name video.example.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

把 `APP_URL` 设为 `https://video.example.com`，生成的链接与 CORS 才会使用 HTTPS 地址。Compose 中 `TRUST_PROXY` 已启用。

## 注意事项

- **FFmpeg 许可证**：运行镜像安装的是 Debian 的 FFmpeg 包，采用 GPL 许可证。FFmpeg 是系统依赖，不会链接进 MIT 应用代码；但分发镜像仍等于分发 FFmpeg。如有要求，请自行构建 LGPL 版运行镜像。
- **默认单机**：PostgreSQL 与 Redis 和应用同机运行。需要横向扩容时把它们外置，并使用 S3 存储。
- **上传大小**：gateway 允许最大 2 GB 请求体。如果调高站点上传上限，也要同步修改 `docker/nginx.conf` 中的 `client_max_body_size`。
- **备份不会自动执行**：请为上述命令配置定时任务，或使用自己的 PostgreSQL 与卷备份方案。
- **本地测试目录**：`docker-test/` 已加入 `.gitignore`，本地生成的密钥与数据不会被误提交。
