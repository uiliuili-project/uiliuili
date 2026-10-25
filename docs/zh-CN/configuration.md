# 配置

> [English](../configuration.md)

安装器会写入两个文件：

- `.env` — 基础设施与密钥，权限 `0600`
- `config/instance.json` — 安装标记、实例 ID、版本信息

两个文件都不要提交到版本库。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `DB_SCHEMA` | 应用 schema（本版本固定为 `uiliuili`） |
| `APP_KEY` | 32 字节十六进制密钥，用于加密第三方密钥 |
| `UILIUILI_ROOT` | 保存 `.env`、`config/` 与 `storage/` 的目录，默认为工作目录（容器使用 `/data`） |
| `APP_URL` | 公开站点 URL |
| `API_INTERNAL_URL` | Next.js SSR 使用的内部 API 地址 |
| `NEXT_PUBLIC_API_URL` | 公开 API 前缀，同源部署时通常留空 |
| `REDIS_URL` | 可选的 Redis 连接串 |
| `MEILISEARCH_URL`、`MEILISEARCH_KEY` | 可选的搜索引擎 |
| `API_PORT` | API 端口，默认 3001 |
| `STORAGE_ROOT` | 本地上传目录 |
| `FFMPEG_PATH`、`FFPROBE_PATH` | 可执行文件路径 |
| `TRANSCODE_CONCURRENCY` | 转码并发数 |
| `INSTALL_TOKEN` | 可选的固定安装令牌 |
| `INSTALL_ALLOW_LOCALHOST` | 允许本机回环请求免令牌安装 |
| `TRUST_PROXY` | 信任反向代理请求头 |

环境变量的优先级高于数据库中的站点设置。

## 安装 JSON

```json
{
  "locale": "zh-CN",
  "database": {
    "host": "127.0.0.1",
    "port": 5432,
    "database": "uiliuili",
    "user": "uiliuili",
    "password": "change-me",
    "ssl": false,
    "schema": "uiliuili",
    "createIfMissing": true
  },
  "site": {
    "name": "uiliuili",
    "description": "一个自托管视频社区",
    "url": "https://video.example.com",
    "timezone": "Asia/Shanghai",
    "locale": "zh-CN",
    "registration": "open"
  },
  "admin": {
    "username": "admin",
    "email": "admin@example.com",
    "password": "a-strong-password-123"
  },
  "storage": { "driver": "local", "localPath": "./storage/uploads" },
  "search": { "driver": "postgres" },
  "demoContent": false
}
```

## 站点设置

运行时设置保存在 PostgreSQL 中，可在管理后台修改：站点信息、注册策略、上传限制、播放默认值、弹幕规则、社交限制、推荐权重、存储、转码、邮件、OAuth、搜索、安全与审计保留天数。

数据库中的密钥使用 `APP_KEY` 加密。请务必备份 `.env`；丢失 `APP_KEY`
会导致已保存的第三方密钥无法解密。
