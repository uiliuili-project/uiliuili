# 安装

> [English](../installation.md)

## 环境要求

- Node.js 22 或更高版本
- PostgreSQL 16 或更高版本
- FFmpeg 7，且 `ffmpeg` 与 `ffprobe` 可直接调用
- 可选：Redis 7、Meilisearch 1.x、S3 兼容存储、SMTP 服务器

安装依赖后运行 `pnpm cli doctor`，可检查 Node.js、FFmpeg、PostgreSQL、目录写权限和迁移状态。

```bash
corepack enable
pnpm install
pnpm build
```

## 启动

在进程管理器下启动 API、worker、Next.js 公开站和管理后台（`infra/systemd`
中提供了 systemd 单元文件）。

首次启动时，API 检测到 `config/instance.json` 不存在，会进入仅安装模式。访问站点根路径，页面会引导到 `/admin/install`。

安装器要求一次性令牌。API 启动时会在控制台打印令牌，并写入
`storage/install-token`。在开发环境中，当
`INSTALL_ALLOW_LOCALHOST=true` 时，本机回环请求可以跳过令牌。

## 安装向导步骤

1. 环境检查
2. PostgreSQL 连接与 schema
3. 站点信息与管理员账号
4. 本地或 S3 存储
5. 可选的 Redis、Meilisearch、SMTP、OAuth
6. 确认并安装

安装器会写入 `.env` 与 `config/instance.json`，在事务中执行迁移和种子数据，创建管理员，然后关闭自身并请求重启服务。

## 无界面安装

```bash
pnpm cli install --config install.json
```

配置格式见[配置](configuration.md)。

## 安装后检查

安装完成后，打开管理后台的系统状态页面，确认：

- 数据库与迁移状态；
- FFmpeg 是否可用；
- 存储写入测试；
- 可选的邮件测试；
- 队列 worker 状态。
