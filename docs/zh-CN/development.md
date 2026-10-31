# 开发指南

> [English](../development.md)

本文面向修改代码或编写扩展的贡献者。只想部署站点，请看[安装](installation.md)或[Docker 部署](docker.md)。

## 环境准备

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | 22+ | `engines` 中已声明 |
| pnpm | 9.15.9 | 通过 `corepack enable` 启用 |
| PostgreSQL | 16+ | 本地开发必须有 |
| FFmpeg / ffprobe | 6+（推荐 7） | 转码与媒体探测 |
| Redis | 7，可选 | 多实例或测试 Socket.IO 广播时使用 |

```bash
corepack enable
pnpm install
```

如果本机没有 PostgreSQL，可以只用 Docker 启动依赖服务，应用仍然在宿主机上运行：

```bash
docker run -d --name uiliuili-dev-db \
  -e POSTGRES_USER=uiliuili \
  -e POSTGRES_PASSWORD=uiliuili \
  -e POSTGRES_DB=uiliuili \
  -p 5432:5432 postgres:16-alpine

docker run -d --name uiliuili-dev-redis -p 6379:6379 redis:7-alpine
```

## 配置

```bash
cp .env.example .env
```

开发环境至少填写：

```dotenv
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgres://uiliuili:uiliuili@127.0.0.1:5432/uiliuili
APP_KEY=<openssl rand -hex 32>
INSTALL_ALLOW_LOCALHOST=true
```

`INSTALL_ALLOW_LOCALHOST=true` 只用于本机开发，生产环境必须保持 `false`。其余变量见[配置](configuration.md)。

## 启动开发服务

一次启动全部应用：

```bash
pnpm dev
```

或分开启动，便于查看单个进程的日志：

```bash
pnpm --filter @uiliuili/api dev      # http://127.0.0.1:3001
pnpm --filter @uiliuili/worker dev
pnpm --filter @uiliuili/web dev      # http://localhost:3000
pnpm --filter @uiliuili/admin dev    # http://localhost:5173/admin/
```

默认端口：

| 应用 | 地址 |
| --- | --- |
| 公开站（Next.js） | <http://localhost:3000> |
| 管理后台（Vite） | <http://localhost:5173/admin/> |
| API | <http://127.0.0.1:3001> |
| Swagger | <http://127.0.0.1:3001/api/docs> |

Next.js 已把 `/api` 与 `/media` 重写到 `API_INTERNAL_URL`（默认 `http://127.0.0.1:3001`），Vite 也代理了这两个前缀。**弹幕 WebSocket 不走重写**，本地开发需要：

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001 pnpm --filter @uiliuili/web dev
```

## 首次安装

未安装时 API 只提供安装接口。两种方式任选：

**网页安装器**：启动 API 后打开 <http://localhost:3000/admin/install>，令牌在 API 启动日志中，也会写入 `storage/install-token`。

**命令行安装**：

```bash
pnpm build
pnpm cli install --from-env
```

`--from-env` 读取 `DATABASE_URL`、`APP_URL`、`APP_KEY`、`SITE_*`、`STORAGE_*` 等变量并完成迁移与种子数据。也可以使用 JSON 配置：`pnpm cli install --config install.json`。

安装完成后重启 API，然后注册第一个账号成为站长。

常用运维命令：

```bash
pnpm cli status                 # 实例与迁移状态
pnpm cli doctor                 # 环境检查
pnpm cli migrate                # 执行待应用迁移
pnpm cli owner:promote --username owner --email owner@example.com
pnpm cli reset --force          # 移除安装标记（默认保留数据库）
```

## 数据库与迁移

Schema 位于 `packages/db/src/schema.ts`，迁移文件在 `packages/db/migrations`。

修改 schema 后生成迁移：

```bash
pnpm db:generate
```

提交前检查生成的 SQL，尤其是数据回填和破坏性变更。迁移由 `pnpm cli migrate` 或管理后台的升级中心执行，应用启动时不会自动迁移。

## 质量检查

提交前运行：

```bash
pnpm lint        # Biome
pnpm typecheck   # 全部 workspace 类型检查
pnpm test        # Vitest 单元测试
pnpm build       # 生产构建
```

只检查单个包：

```bash
pnpm --filter @uiliuili/api test
pnpm --filter @uiliuili/web typecheck
```

格式化与自动修复：

```bash
pnpm format
pnpm lint:fix
```

## 目录结构

```text
apps/
  api/             NestJS API、鉴权、安装接口、WebSocket
  worker/          FFmpeg 转码、索引、推荐、清理任务
  web/             Next.js 公开站
  admin/           Vite + React 管理后台与安装向导
  cli/             安装与运维命令行
  video-node/      可选的外部视频节点（独立主机转码/上传）
packages/
  db/              Drizzle schema、迁移、种子数据
  installer/       安装校验、配置生成、迁移执行
  media/           存储驱动、FFmpeg、HLS
  shared/          Zod 契约、权限、错误码
  danmaku/         Canvas 弹幕引擎与 B 站 XML 转换
  i18n/            中英文文案
  video-node-contract/  主站与视频节点的协议
infra/             Nginx、systemd、备份与安装脚本
docs/              文档（中文在 docs/zh-CN）
```

## 代码约定

- 使用 Biome 统一格式与检查；TypeScript 严格模式。
- API 输入用 Zod schema 校验，错误通过统一异常过滤器返回。
- 权限以角色为准，用户组只决定界面；新增权限同时更新 `packages/shared` 与使用处。
- 所有用户可见文案走 `packages/i18n`，中文与英文同时补齐。
- 新接口补 Swagger 注解；涉及权限、地区或审核的接口补单元测试。
- 数据库写入遵循现有事务模式，计数与互动记录在同一事务内更新。

## 文案与界面语言

`packages/i18n/src/locales/` 下包含 `zh-CN`、`en-US` 与后台使用的 `ui-en.ts`。新增 key 必须同时出现在两种语言中；缺失时回退到中文。界面语言可在站点设置和用户偏好中切换。

## 提交与 Pull Request

- 使用 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`chore:`。
- 一个提交只做一件事；数据库迁移与使用它的代码放在同一提交或相邻提交。
- PR 描述写清动机、行为变化、验证方式和截图（界面改动）。
- 确保 `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 全部通过。

更多信息见 [CONTRIBUTING.md](../../CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md)。
