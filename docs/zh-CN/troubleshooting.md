# 故障排查

> [English](../troubleshooting.md)

先收集以下信息，再对照本文排查：

```bash
# Docker
docker compose ps
docker compose logs --tail=100 bootstrap api worker

# 原生
pnpm cli status
pnpm cli doctor
journalctl -u uiliuili-api -u uiliuili-worker -n 100 --no-pager
```

`pnpm cli doctor` 会检查 Node.js、FFmpeg、PostgreSQL、配置目录写权限和迁移状态，是原生部署的第一站。

## 安装相关

### 提示 `APP_KEY` 无效或加密设置无法读取

`APP_KEY` 必须是 **64 个十六进制字符**（32 字节）：

```bash
openssl rand -hex 32
```

安装完成后不要再更换 `APP_KEY`。数据库中的 S3、SMTP、OAuth、验证码和 AI 审核密钥都用它加密；更换后这些设置会变成乱码，只能重新填写。备份时请把 `.env` 与数据库放在一起。

### 数据库连接失败 / `DATABASE_URL` 解析错误

- 密码包含 `@`、`:`、`/`、`#`、`?` 等字符时必须做 URL 编码（例如 `@` 写成 `%40`）。
- Docker 的 `DB_PASSWORD` 会直接拼进连接串，请只用字母、数字、`-`、`_`、`.`。`scripts/quickstart.sh` 和文档中的 `openssl rand -base64 24 | tr '+/' '-_' | tr -d '='` 都满足这一点。
- 确认 PostgreSQL 正在运行、端口可达、库与用户已创建：

```bash
pg_isready -h 127.0.0.1 -p 5432
psql "$DATABASE_URL" -c 'select 1'
```

### 安装向导打不开，或一直要求安装令牌

- PostgreSQL 版本低于 16、缺少权限或迁移未执行会让 API 停留在仅安装模式。
- 原生部署：安装令牌在 API 启动日志中打印，同时写入 `storage/install-token`：

```bash
cat storage/install-token
journalctl -u uiliuili-api -n 50 --no-pager | grep -i token
```

- Docker：`docker compose logs bootstrap | grep -i token`。
- `INSTALL_ALLOW_LOCALHOST` 只应在本机开发时设为 `true`，生产环境保持 `false`。
- 已安装后仍看到安装页，说明 `config/instance.json` 不存在或 `UILIUILI_ROOT` 指向了别的目录。确认服务使用的工作目录与 `.env` 中 `UILIUILI_ROOT` 一致。

### 站长认领码丢失

认领码只在首次安装时显示一次，数据库中只保存哈希。若还没有站长：

```bash
# 原生
pnpm cli owner:promote --username owner --email owner@example.com

# Docker
docker compose run --rm bootstrap node dist/index.js owner:promote \
  --username owner --email owner@example.com
```

该命令会创建或提升目标账号，并把当前站长降为管理员。`admin:create` 是它的别名。

### `bootstrap` 容器退出，API 没有启动

这是刻意设计：`bootstrap` 失败时 API 与 worker 不启动，避免半安装实例对外服务。

```bash
docker compose logs --tail=200 bootstrap
```

常见原因：`APP_KEY` 为空或长度不对、`DB_PASSWORD` 含特殊字符、数据库卷权限错误、磁盘已满。修复后重新执行 `docker compose up -d`；`bootstrap` 会自动重试迁移。

### 端口被占用

```bash
ss -ltnp | grep 8080
```

Docker 修改 `GATEWAY_PORT`（同时同步 `APP_URL`），或直接：

```bash
./scripts/quickstart.sh --port 9090
```

原生部署修改 `API_PORT` 和 Nginx 的 `proxy_pass`。

## 运行相关

### 页面能打开，但 API 请求全部失败

- 检查 `/health`：

```bash
curl -i http://127.0.0.1:8080/health
```

- Nginx 必须把 `/api`、`/media`、`/socket.io` 反代到 API，`/` 反代到 Next.js。参考 `infra/nginx/uiliuili.conf`。
- 反向代理部署时设置 `TRUST_PROXY=true`，否则限流、地区和安装判断会拿到代理 IP。
- `APP_URL` 必须与浏览器地址一致（协议、域名、端口）；不一致会导致 Cookie、CORS 和 OAuth 回调异常。

### 登录后立即掉线，或写操作返回 CSRF 错误

写请求需要 `x-csrf-token` 请求头与 `ul_csrf` Cookie 匹配。前端已自动处理；如果你在做反向代理或自定义客户端：

- 不要剥离 `Set-Cookie` 和 `Cookie`；
- 前后端必须同源，或正确配置 `NEXT_PUBLIC_API_URL`；
- HTTPS 站点不要混用 HTTP 地址访问。

### 弹幕不同步，或 WebSocket 连不上

- Nginx 必须转发升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

- 多 API 实例必须配置 `REDIS_URL`，否则 Socket.IO 只会在单个进程内广播。
- 检查浏览器控制台的 `/socket.io` 请求是否被打到了静态文件或错误端口。

### 上传返回 413

请求体超过了 Nginx 限制。Docker 网关默认 2 GB，可在 `docker/nginx.conf` 调整：

```nginx
client_max_body_size 2g;
```

原生部署在站点配置中同样设置，并确认 `proxy_request_buffering off;`（示例配置已包含）。同时检查管理后台的上传大小设置。

### 上传完成但转码一直排队

1. 确认 worker 正在运行：

```bash
docker compose ps worker
journalctl -u uiliuili-worker -n 100 --no-pager
```

2. 确认 `ffmpeg` 与 `ffprobe` 可执行：

```bash
ffmpeg -version
ffprobe -version
```

3. 队列积压时提高 `TRANSCODE_CONCURRENCY`，但不要超过 CPU 能承受的范围；更有效的方式是增加 worker 实例。
4. 磁盘写满会让任务反复失败，检查 `storage/` 与数据库所在分区。

### 管理后台页面是旧的

管理后台是 Nginx 直接提供的静态文件（`apps/admin/dist`）。升级代码后需要重新构建并替换该目录，然后刷新浏览器缓存；只重启 API 不会更新后台页面。Docker 部署重建镜像即可。

### 迁移待执行 / 升级后报数据库结构不匹配

```bash
pnpm cli migrate          # 原生
docker compose up -d      # Docker：bootstrap 会自动迁移
```

也可以登录管理后台，在**系统状态 → 升级中心**创建备份并执行数据库升级。升级前务必先备份数据库与 `.env`。

### 忘记管理员密码，且邮件不可用

由服务器上的 CLI 重置，或提升另一个账号为站长：

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

站点启用了 SMTP 时，也可以使用登录页的“忘记密码”。

### 升级后无法解密集成密钥

说明 `APP_KEY` 变了。恢复升级前的 `.env`；如果已丢失，只能在管理后台重新填写 S3、SMTP、OAuth、验证码和 AI 审核密钥。

## 性能与容量

- **转码慢**：libx264 在 `veryfast` 下 1080p 每路约需 2–3 vCPU。`TRANSCODE_CONCURRENCY` 建议设为物理核心数的三分之一左右。
- **播放卡顿**：先确认是不是带宽瓶颈；100 个 720p 观众约需 280 Mbps 持续下行，超过约 100 Mbps 就应考虑 CDN。
- **数据库慢**：使用 NVMe 或高 IOPS 云盘，`shared_buffers` 约为内存的 25%。
- **内存不足**：每个 FFmpeg 任务约 300–600 MB RSS，另加 Node.js 进程开销；建议保留 2–4 GB swap 作为 OOM 缓冲。

更多容量规划见[原生部署 · 服务器推荐配置](deployment.md#服务器推荐配置)。
