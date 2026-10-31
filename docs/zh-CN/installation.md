# 安装

> [English](../installation.md)

萌悠有两条安装路径：

| 方式 | 适合 | 耗时 |
| --- | --- | --- |
| [Docker](#docker-安装) | 想最快跑起来、愿意使用容器 | 约 5 分钟 |
| [原生安装](#原生安装) | 直接运行在宿主机、已有 Nginx/PostgreSQL 或需要自定义 | 约 15–30 分钟 |

只想在服务器上跑一个完整站点，推荐 Docker。需要与现有服务共存、使用系统 PostgreSQL、或自己管理进程时，使用原生安装。

## 环境要求

| 组件 | 要求 |
| --- | --- |
| Node.js | 22 或更高 |
| pnpm | 9.15.9，通过 `corepack enable` 启用 |
| PostgreSQL | 16 或更高（15 可运行但会提示） |
| FFmpeg / ffprobe | 6 或更高，推荐 7；必须能直接执行 |
| 操作系统 | Ubuntu 24.04 LTS 或 Debian 13；Debian 12 需额外安装新版 FFmpeg 与 PostgreSQL |
| 可选 | Redis 7、Meilisearch 1.x、S3 兼容存储、SMTP、OAuth |

Docker 镜像已内置 Node.js 22 与 FFmpeg 7，宿主机只需 Docker Engine 和 Compose v2。

## Docker 安装

```bash
git clone https://github.com/uiliuili-project/uiliuili.git
cd uiliuili
./scripts/quickstart.sh
```

脚本会自动生成 `.env`、`APP_KEY` 和 `DB_PASSWORD`，构建并启动整套服务，等待健康检查通过，最后打印站点地址和**一次性的站长认领码**。

打开 <http://localhost:8080>，注册第一个账号并填写认领码，然后登录 <http://localhost:8080/admin/>。

修改端口：

```bash
./scripts/quickstart.sh --port 9090
```

手动配置、生产部署、备份和 TLS 见 [Docker 部署](docker.md)。Docker 安装不需要继续阅读下面的原生步骤。

## 原生安装

下面的命令以 Ubuntu 24.04 / Debian 13 为例，安装目录为 `/opt/uiliuili`。

### 1. 安装系统依赖

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates postgresql redis-server ffmpeg
```

确认版本：

```bash
node --version     # v22 或更高
ffmpeg -version
ffprobe -version
psql --version     # 16 或更高
```

Debian 12 自带的 FFmpeg 与 PostgreSQL 版本较旧。请从 [PGDG](https://www.postgresql.org/download/linux/debian/) 安装 PostgreSQL 16+，并从 backports 安装较新的 FFmpeg，或直接使用 Docker。

### 2. 创建数据库

```bash
sudo -u postgres psql <<'SQL'
CREATE USER uiliuili WITH PASSWORD 'change-me';
CREATE DATABASE uiliuili OWNER uiliuili;
SQL
```

把 `change-me` 换成强密码；后面的 `DATABASE_URL` 必须使用同一个密码。

密码含特殊字符时，写入 `DATABASE_URL` 前必须做 URL 编码。更省事的做法是使用只含字母、数字、`-`、`_` 的密码：

```bash
openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
```

Redis 是可选的。单机部署可以跳过；多 API 实例或需要跨进程弹幕广播时必须启用。

### 3. 获取代码并构建

```bash
sudo mkdir -p /opt/uiliuili
sudo chown "$USER":"$USER" /opt/uiliuili
git clone https://github.com/uiliuili-project/uiliuili.git /opt/uiliuili
cd /opt/uiliuili

corepack enable
pnpm install --frozen-lockfile
pnpm build
```

`pnpm build` 会构建 API、worker、公开站、管理后台和 CLI。构建完成后才能使用 `pnpm cli`。

### 4. 配置环境变量

```bash
cp .env.example .env
```

至少修改：

```dotenv
NODE_ENV=production
APP_URL=https://video.example.com
API_INTERNAL_URL=http://127.0.0.1:3001
DATABASE_URL=postgres://uiliuili:change-me@127.0.0.1:5432/uiliuili
APP_KEY=<openssl rand -hex 32>
INSTALL_ALLOW_LOCALHOST=false
```

说明：

- `APP_URL` 必须是浏览器最终访问的地址（协议、域名、端口一致）。
- `APP_KEY` 是 64 位十六进制，安装后不要再修改，并和数据库一起备份。
- 可选变量（Redis、Meilisearch、S3、SMTP、转码并发等）见[配置](configuration.md)。

检查环境与数据库：

```bash
pnpm cli doctor
```

### 5. 执行安装

两种方式任选其一。

**命令行安装（推荐用于服务器）**

```bash
pnpm cli install --from-env
```

它会读取 `.env` 中的 `DATABASE_URL`、`APP_URL`、`APP_KEY`、`SITE_*`、`STORAGE_*` 等变量，执行迁移和种子数据，并打印站长认领码。也可以使用 JSON 配置：

```bash
pnpm cli install --config install.json
```

**网页安装器**

先按第 6 步启动 API，然后打开 `https://video.example.com/admin/install`。安装令牌会在 API 启动日志中打印，并写入 `storage/install-token`：

```bash
cat storage/install-token
```

安装器会写入 `.env` 与 `config/instance.json`，在事务中执行迁移和种子数据，然后关闭安装接口并请求重启服务。它**不会**创建管理员账号。

### 6. 启动服务

原生部署需要 API、worker、web 三个进程，管理后台是静态文件。使用仓库提供的 systemd 单元与 Nginx 配置；先按[原生部署 · 目录与用户](deployment.md#目录与用户)创建服务用户并设置目录权限：

```bash
sudo cp infra/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now uiliuili-api uiliuili-worker uiliuili-web
```

Nginx 配置与目录权限见[原生部署](deployment.md)。如果只是本机验证，也可以直接运行：

```bash
node apps/api/dist/main.js
node apps/worker/dist/main.js
pnpm --filter @uiliuili/web start
```

### 7. 创建站长

打开站点，注册第一个账号。该账号会成为站长并获得全部权限。

- 从服务器本机（回环地址）注册不需要认领码。
- 从其他地址注册必须填写安装时打印的**站长认领码**。
- 请在向访客开放前完成这一步：站长尚未产生时，第一次注册会绕过注册策略。

认领码只保存哈希且只显示一次。丢失或站长账号不可用时：

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

不提供密码时会生成随机密码并打印。之后可以在**管理后台 → 用户 → 设为站长**中转移站长身份。

## 安装后检查

打开管理后台的系统状态页面，确认：

- 数据库连接与迁移状态，没有待执行迁移；
- FFmpeg 可用；
- 存储写入测试通过；
- worker 正常运行，队列没有长期积压；
- 反向代理或 CDN 发送了配置的国家请求头，或 `region.fallback` 符合预期；
- **设置 → 地区与限制级内容**中的国家列表正确。

建议再完成一次真实投稿：上传短视频，确认转码完成、可以播放、弹幕与评论可用。

## 下一步

- 配置 Nginx、HTTPS、systemd 与容量：[原生部署](deployment.md)
- 修改站点设置与环境变量：[配置](configuration.md)
- 升级、备份与恢复：[升级与备份](upgrade.md)
- 遇到问题：[故障排查](troubleshooting.md)
