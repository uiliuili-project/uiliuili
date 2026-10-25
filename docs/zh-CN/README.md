# uiliuili 文档（简体中文）

uiliuili 是一个开源、自托管的弹幕视频平台。本目录是中文文档；英文文档位于 [`docs/`](../)。

## 开始使用

- [安装](installation.md) — 环境要求、构建、首次启动与安装向导
- [部署](deployment.md) — Nginx、systemd、**服务器推荐配置**与扩容
- [配置](configuration.md) — `.env` 环境变量、安装 JSON、站点设置
- [升级、备份与恢复](upgrade.md) — 版本升级与数据保护

## 功能与集成

- [架构](architecture.md) — 进程模型、应用与包的职责、请求链路
- [API 概览](api.md) — REST 路由、鉴权与 WebSocket 协议
- [弹幕](danmaku.md) — 数据模型、实时协议与渲染引擎
- [邮件与 OAuth](oauth.md) — SMTP、GitHub/Google/OIDC 登录
- [S3 存储](s3.md) — 对象存储配置、CORS 与权限

## 版本与依赖

| 项目 | 要求 |
| --- | --- |
| Node.js | 22 或更高 |
| PostgreSQL | 16 或更高 |
| FFmpeg / ffprobe | 7 或更高 |
| 可选组件 | Redis 7、Meilisearch 1.x、S3 兼容存储、SMTP、OAuth |
| 许可证 | MIT |
| 运行时容器 | 不依赖 Docker |

界面默认简体中文，English 为完整翻译，站点与管理后台均可切换语言。

## 常见问题入口

- 安装向导打不开或提示令牌错误：见[安装](installation.md)。
- 转码排队慢：见[部署 · 容量与转码并发](deployment.md#容量与转码并发)。
- 多实例部署弹幕不同步：需要 Redis，见[部署 · 扩容](deployment.md#扩容)。
- 升级后无法登录或页面异常：见[升级、备份与恢复](upgrade.md)。
