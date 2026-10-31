# 萌悠文档

> [English](../README.md)

「萌悠 / MoeYou」是一个开源、自托管的弹幕视频平台。仓库名、包作用域、CLI 命令、环境变量前缀和数据库 schema 仍为 `uiliuili`，只有产品显示名是「萌悠」。

## 从这里开始

| 我想… | 文档 |
| --- | --- |
| 用一条命令通过 Docker 安装 | [Docker 部署](docker.md) |
| 直接在服务器上安装 | [安装](installation.md) |
| 配置 Nginx、systemd 与容量 | [原生部署](deployment.md) |
| 修改环境变量或站点设置 | [配置](configuration.md) |
| 升级、备份或恢复 | [升级与备份](upgrade.md) |
| 排查安装或运行问题 | [故障排查](troubleshooting.md) |

## 开发与扩展

| 我想… | 文档 |
| --- | --- |
| 搭建本地开发环境 | [开发指南](development.md) |
| 了解进程模型、包结构与请求链路 | [架构](architecture.md) |
| 调用 REST API 或连接 WebSocket | [API 概览](api.md) |
| 了解投稿、审核与创作中心流程 | [创作中心](creator-studio.md) |
| 了解弹幕存储与渲染 | [弹幕](danmaku.md) |
| 配置 SMTP 与 OAuth | [邮件与 OAuth](oauth.md) |
| 使用 S3 兼容对象存储 | [S3 存储](s3.md) |

## 依赖一览

| 组件 | 要求 |
| --- | --- |
| Node.js | 22 或更高 |
| PostgreSQL | 16 或更高（15 可用但会提示） |
| FFmpeg / ffprobe | 6 或更高；推荐 7，Docker 镜像已内置 |
| 可选 | Redis 7、Meilisearch 1.x、S3 兼容存储、SMTP、OAuth |
| 许可证 | MIT |

界面默认简体中文，英文为完整翻译。创作中心位于 `/studio`，管理后台位于 `/admin/`，两者按数据库中的用户组区分入口。

## 获取帮助

- 先查阅[故障排查](troubleshooting.md)。
- 使用 [Issue 模板](https://github.com/uiliuili-project/uiliuili/issues/new/choose)反馈问题。
- 安全问题请按 [SECURITY.md](../../SECURITY.md) 私下报告，不要公开提交 Issue。
