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
  "storage": { "driver": "local", "localPath": "./storage/uploads" },
  "search": { "driver": "postgres" },
  "demoContent": false
}
```

## 站点设置

运行时设置保存在 PostgreSQL 中，可在管理后台修改：站点信息（含站点 Logo）、注册策略、上传限制、播放默认值、弹幕规则、社交限制、推荐权重、存储、转码、邮件、OAuth、搜索、安全与审计保留天数。

数据库中的密钥使用 `APP_KEY` 加密。请务必备份 `.env`；丢失 `APP_KEY`
会导致已保存的第三方密钥无法解密。

## 用户组与界面

每个用户记录都保存一个 `user_group` 标记。角色仍然是权限的唯一来源；角色变化时会重新计算该标记，升级迁移也会为已有账号补齐。

| 角色 | 用户组 | 名称 | 可用界面 |
| --- | --- | --- | --- |
| `USER` | `USER` | 普通用户 | 创作中心 |
| `UPLOADER` | `CREATOR` | 创作者 | 创作中心 |
| `REVIEWER` | `REVIEWER` | 审核员 | `/admin/review` 审核台 |
| `ADMIN` | `ADMIN` | 管理员 | `/admin/` 管理后台 |
| `SUPER_ADMIN` | `OWNER` | 站长 | 全部功能，可转移站长身份 |

创作中心位于 `/studio`。审核员在审核台处理视频、评论、弹幕与举报；管理员在此基础上增加推荐、用户管理、分区、公告、站点与内容设置、系统状态和审计日志；站长还拥有集成与安全设置、角色分配和站长转移权限。

同一时间只能有一个站长账号，由部分唯一索引保证。安装后注册的第一个账号会自动成为站长，安装器不再创建初始管理员。安装器会打印一次性的**站长认领码**；从非本机地址注册站长账号时必须填写，服务器本机（回环地址）注册则不需要。认领码只保存哈希，站长产生后立即删除。

如果站长账号丢失，可使用 CLI 恢复：

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

`admin:create` 仍可作为别名使用。该命令会在事务中把当前站长降为管理员，并提升或创建目标账号。

