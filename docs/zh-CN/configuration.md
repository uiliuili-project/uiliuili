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

## 地区与限制级内容

访问控制只使用 ISO 3166-1 alpha-2 两位国家代码；省份仅用于中国地区的 IP 属地展示，不参与限制判定。每次请求按以下顺序判定地区：

1. 已登录账号在注册时自动记录的地区，用户不能修改；
2. 配置的国家请求头（默认 `cf-ipcountry`），通常由反向代理或 CDN 提供；
3. 可选 MaxMind `.mmdb` 数据库，需安装 `maxmind` 依赖；
4. 配置的默认地区。

管理员可以在**用户管理**中更正账号地区，更正后 `regionSource` 记为 `admin`。

功能由两组设置控制：

| 设置组 | 字段 | 作用 |
| --- | --- | --- |
| `region` | `fallback`、`header`、`provinceHeader`、`geoipDatabase` | 地区判定方式，以及中国省份请求头 |
| `restricted` | `blockedRegions`、`defaultBehavior`、`defaultMessage` | 哪些国家不能发布或播放限制级内容，以及拒绝时的展示 |

`blockedRegions` 是唯一权威清单。标记为限制级的视频始终以
`regionMode = 'block'` 存储该清单的副本；保存设置时会刷新所有限制级视频已存储的策略。未被勾选的国家均为无限制地区。

在无限制地区，每个用户可以设置个人的**显示限制级内容**偏好，默认关闭。限制级内容始终要求登录；匿名访问详情页会返回需要登录的 451。拥有 `video:review` 或 `video:manage_any` 权限的工作人员以及投稿者本人可以绕过地区限制，用于审核和预览。

普通视频也可以设置 `regionMode = 'block'` 并指定自己的 `regionCodes`。拒绝展示使用站点默认值，或使用单个视频的 `regionDenyBehavior`（`message` 或 `not_found`）与提示文案。列表接口在 SQL 层过滤被屏蔽的视频；详情与播放接口返回 HTTP 451 和错误码 `REGION_RESTRICTED`，视频选择 `not_found` 时返回 404。

## IP 属地展示

评论和动态在发布时保存一份地区快照（`ip_region`）。它按**网络地区**解析，与用于访问控制的账号地区是两套独立逻辑：

1. 配置的国家请求头（默认 `cf-ipcountry`）；
2. 可选 MaxMind `.mmdb` 数据库（已安装时）；
3. 已登录账号存储的地区；
4. 配置的默认地区。

中国地区的属地会精确到省份，需要满足以下任一条件：

- GeoIP 数据库使用 MaxMind **GeoLite2-City**（含 `subdivisions`），并按上面的顺序生效；
- 配置了 `region.provinceHeader`（例如 Vercel 的 `x-vercel-ip-country-region`），由 CDN 提供 ISO 3166-2 省份代码。

此时 `ip_region` 与 `users.last_region` 保存为 `CN-<省份代码>`（如 `CN-ZJ`），页面显示“浙江”；没有省份数据时仍只显示“中国”。其他国家和地区仍只显示国家名称。省份不参与任何访问控制。

不保存原始 IP。功能启用前的历史内容不会回填，因此不会显示属地。

`privacy.ipLocation`（默认开启，位于**设置 → 地区**）控制是否展示。关闭后接口不再返回评论、动态的 `ipRegion` 和个人资料的 `lastRegion`，但不会删除已保存的值；重新开启即恢复展示。个人空间展示账号最近一次请求解析出的网络地区（`users.lastRegion`），仅在已登录请求时刷新，且只用于展示。

## 空间头图与图片上传

用户可以在**设置 → 个人资料**中上传空间头图。浏览器会先按 4:1 居中裁剪为 1920×480，再编码为 WebP（不支持时退回 JPEG）后上传，因此存储文件体积可控。接口：

- `PUT /api/v1/auth/cover` — 原始 JPEG、PNG 或 WebP 请求体，最大 10 MB；
- `DELETE /api/v1/auth/cover` — 删除已保存的头图文件。

图文动态通过 `POST /api/v1/uploads/images` 逐张上传（原始请求体，单张最大 10 MB，每条动态最多 9 张，每个用户每小时 60 次）。共用上传器按文件头魔数校验，不信任声明的 Content-Type；SVG 及其他格式会被拒绝。动态保存的是接口返回的 URL。

## 图文瀑布流

首页提供“视频 / 图文”切换。`/?mode=moments` 会用带至少一张图片的公开动态组成瀑布流，并排除被封禁的作者和当前用户屏蔽的作者。它仍是首页路由上的查询模式，而不是独立页面，因此既有链接和分享方式不受影响。接口：`GET /api/v1/feed/moments?limit=&cursor=`（公开，游标分页）。

## 标签兴趣推荐

启用后，平台会从最近的观看记录学习标签兴趣：

- 保存播放进度时，按观看深度为视频的每个标签加权（`0.2 + 0.8 × 观看比例`，看完额外 `+0.5`，上限 5）。
- 同一视频最多每 10 分钟学习一次；视频看完时立即学习。`watch_histories.tag_synced_at` 记录最近一次同步时间。
- 每次命中先把已有分值乘以 `0.9` 再累加，因此近期兴趣占主导。每天由 worker 执行 `tag-decay` 任务，把所有分值乘以 `decayPerDay`，并删除低于 `0.05` 的记录。

`recommendation.tagAffinity` 设置组控制该功能：

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `enabled` | `true` | 是否学习并在推荐中使用标签兴趣 |
| `weight` | `0.6` | 排序 SQL 中命中兴趣标签的加权 |
| `ratio` | `0.35` | 首页 12 个推荐位中由兴趣标签池填充的比例（上限 0.8） |
| `decayPerDay` | `0.95` | worker 每日应用的衰减系数 |
| `maxTags` | `8` | 保留并参与推荐的最强标签数量 |

用户可以在**设置 → 推荐偏好**查看、移除或清空已学到的标签（`GET /api/v1/me/tag-interests`、`DELETE /api/v1/me/tag-interests`、`DELETE /api/v1/me/tag-interests/:tagId`）。兴趣只属于本人，不会展示在个人主页。没有学到的标签或功能关闭时，首页会回退到原有的分区与探索混合推荐。

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

