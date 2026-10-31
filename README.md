# 萌悠 (MoeYou)

> 开源、自托管的弹幕视频社区。An open-source, self-hosted danmaku video community.

[![CI](https://github.com/uiliuili-project/uiliuili/actions/workflows/ci.yml/badge.svg)](https://github.com/uiliuili-project/uiliuili/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)

萌悠是一个完整的视频社区：投稿、FFmpeg HLS 转码、Canvas 弹幕播放器、评论、关注、收藏、投币、通知、搜索、推荐和可视化管理后台。它不依赖任何云服务即可单机运行；Redis、Meilisearch、S3、SMTP 和 OAuth 都是可选项。

仓库名、包作用域、CLI 命令、环境变量前缀和数据库 schema 仍为 `uiliuili`；产品显示名为「萌悠 / MoeYou」。

## 快速开始

### Docker（推荐，约 5 分钟）

需要 **Docker Engine + Compose v2**。首次启动会下载镜像并构建应用。

```bash
git clone https://github.com/uiliuili-project/uiliuili.git
cd uiliuili
./scripts/quickstart.sh
```

脚本会：

1. 从 `docker/.env.example` 创建 `.env`，自动生成 `APP_KEY` 与 `DB_PASSWORD`；
2. 构建并启动 PostgreSQL、Redis、API、worker、Web 和 Nginx 网关；
3. 等待健康检查通过；
4. 打印站点地址、管理后台地址和**一次性的站长认领码**。

启动后打开 <http://localhost:8080>，在站点注册第一个账号并粘贴认领码，该账号即成为站长。然后登录 <http://localhost:8080/admin/> 完成站点设置。

- 修改端口：`./scripts/quickstart.sh --port 9090`
- 手动配置与生产部署：[Docker 部署](docs/zh-CN/docker.md)
- 升级、备份与回滚：[升级与备份](docs/zh-CN/upgrade.md)

### 原生安装（Node.js + systemd）

需要 **Node.js 22+、PostgreSQL 16+、FFmpeg 6+（推荐 7）**；管理后台由 Nginx 提供静态文件。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
cp .env.example .env
# 编辑 .env：填写 APP_KEY（openssl rand -hex 32）和 DATABASE_URL
pnpm cli doctor
pnpm cli install --from-env   # 或启动服务后访问 /admin/install 使用网页安装器
```

完整的数据库创建、Nginx、systemd 和首次启动步骤见[安装指南](docs/zh-CN/installation.md)与[原生部署](docs/zh-CN/deployment.md)。

## 主要功能

- **首次安装向导**：环境检查、数据库、站点信息、存储、可选邮件/OAuth，全程中文/英文。
- **视频链路**：断点续传、分片直传 S3、FFmpeg 多清晰度 HLS、封面与字幕。
- **弹幕体验**：Canvas 播放器、滚动/顶部/底部弹幕、6 分钟分片加载、屏蔽与审核、B 站 XML 导入导出。
- **社区功能**：关注、评论、点赞、投币、收藏夹、历史、通知、动态、专栏、合集。
- **创作中心**：独立投稿页（拖拽上传 + 进度）、稿件管理、稿件编辑、数据面板、联合投稿、回收站与申诉。
- **管理后台**：用户、视频、评论、弹幕、举报、分区、公告、审核台、升级中心、审计日志。
- **安全与运营**：Turnstile/reCAPTCHA、分级频率限制、AI 内容审核、地区限制、维护模式、数据库备份。
- **可选增强**：Redis、Meilisearch、S3 兼容存储、SMTP、GitHub/Google/OIDC 登录、外部视频节点。

## 技术栈

| 层 | 选型 |
| --- | --- |
| API | NestJS + Fastify |
| Worker | NestJS standalone + PostgreSQL 队列（`FOR UPDATE SKIP LOCKED`） |
| 数据库 | PostgreSQL 16+ + Drizzle ORM |
| 公开站 | Next.js + React |
| 管理后台 | Vite + React + Ant Design |
| 媒体 | FFmpeg + HLS + Canvas 弹幕引擎 |
| 仓库 | pnpm workspace + Turborepo |

## 文档

| 我想… | 中文 | English |
| --- | --- | --- |
| 用 Docker 安装 | [Docker 部署](docs/zh-CN/docker.md) | [Docker](docs/docker.md) |
| 在服务器上原生安装 | [安装](docs/zh-CN/installation.md) | [Installation](docs/installation.md) |
| 配置 Nginx、systemd、容量 | [原生部署](docs/zh-CN/deployment.md) | [Deployment](docs/deployment.md) |
| 修改环境变量与站点设置 | [配置](docs/zh-CN/configuration.md) | [Configuration](docs/configuration.md) |
| 升级、备份、恢复 | [升级与备份](docs/zh-CN/upgrade.md) | [Upgrade](docs/upgrade.md) |
| 排查安装或运行问题 | [故障排查](docs/zh-CN/troubleshooting.md) | [Troubleshooting](docs/troubleshooting.md) |
| 参与开发 | [开发指南](docs/zh-CN/development.md) | [Development](docs/development.md) |
| 看架构与 API | [架构](docs/zh-CN/architecture.md) · [API](docs/zh-CN/api.md) | [Architecture](docs/architecture.md) · [API](docs/api.md) |
| 接入 S3 / 邮件 / OAuth | [S3](docs/zh-CN/s3.md) · [邮件与 OAuth](docs/zh-CN/oauth.md) | [S3](docs/s3.md) · [Mail and OAuth](docs/oauth.md) |

- 中文文档入口：[docs/zh-CN](docs/zh-CN/README.md)
- English documentation index: [docs](docs/README.md)

## 开发

```bash
pnpm install
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

本地开发、测试和代码结构见[开发指南](docs/zh-CN/development.md)。

## English

MoeYou (萌悠) is a self-hosted danmaku video platform with uploads, FFmpeg HLS transcoding, a Canvas danmaku player, comments, follows, favorites, coins, notifications, search, recommendations, and a visual admin panel. Node.js 22+, PostgreSQL 16+ and FFmpeg 6+ (7 recommended) are required; Redis, Meilisearch, S3, SMTP and OAuth are optional.

The fastest install is Docker:

```bash
git clone https://github.com/uiliuili-project/uiliuili.git
cd uiliuili
./scripts/quickstart.sh
```

Open <http://localhost:8080>, register the first account with the owner claim token printed by the script, and sign in to `/admin/`. See the [Docker guide](docs/docker.md), [installation guide](docs/installation.md), and the full [documentation index](docs/README.md).

## 贡献与安全

- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 行为准则：[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- 安全问题请勿公开提交 Issue：[SECURITY.md](SECURITY.md)

## 许可证

[MIT](LICENSE) © 2026 uiliuili contributors.
