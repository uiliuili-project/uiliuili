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
3. 站点信息
4. 本地或 S3 存储
5. 可选的 Redis、Meilisearch、SMTP、OAuth
6. 确认并安装

安装器会写入 `.env` 与 `config/instance.json`，在事务中执行迁移和种子数据，然后关闭自身并请求重启服务。它**不会**创建管理员。安装结果会显示一次性的站长认领码，请立即保存，之后不再显示。

## 创建站长

打开站点并注册第一个账号，该账号会成为站长并获得全部权限。从服务器本机（回环地址）注册无需认领码；从其他地址注册时需要填写安装器显示的站长认领码。

请在向访客开放站点之前完成这一步：站长尚未产生时，第一次注册会绕过注册策略。认领码只保存哈希，站长产生后立即删除。

如果认领码丢失或站长账号不可用，可执行：

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

`admin:create` 仍可作为别名使用。之后可以在**管理后台 → 用户 → 设为站长**中转移站长身份，当前站长会降为管理员。

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
- 队列 worker 状态；
- 反向代理或 CDN 是否发送了配置的国家请求头，或 `region.fallback` 是否设置为预期的国家；
- **设置 → 地区与限制级内容** 中是否列出了限制级内容不可发布的国家。
