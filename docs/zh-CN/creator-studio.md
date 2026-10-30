# 创作中心

> [English](../creator-studio.md)

创作中心位于 `/studio`，是多页面工作台，而不是单一投稿表单。桌面端左侧导航固定在页面内，窄屏时同一组入口变为横向标签栏。

## 页面

| 路径 | 用途 |
| --- | --- |
| `/studio` | 概览：最近稿件、审核状态、快捷入口 |
| `/studio/videos` | 全部稿件，支持搜索、筛选与状态查看 |
| `/studio/videos/new` | 上传并创建新稿件 |
| `/studio/videos/:id` | 编辑信息、创作声明、联合投稿、申诉与状态记录 |
| `/studio/analytics` | 播放、互动、来源、设备、国家、热门稿件 |
| `/studio/comments` | 评论收件箱，可隐藏、恢复、删除 |
| `/studio/danmaku` | 弹幕收件箱，可隐藏、恢复 |
| `/studio/collections` | 合集与系列，支持条目管理 |
| `/studio/columns` | 专栏长文与编辑器 |
| `/studio/fans` | 粉丝总数、增长趋势、最近关注 |
| `/studio/growth` | 经验、等级进度、勋章、任务 |
| `/studio/messages` | 审核、评论、粉丝与联合投稿通知 |
| `/studio/collaborations` | 接受或拒绝联合投稿邀请 |
| `/studio/appeals` | 申诉记录与审核回复 |
| `/studio/trash` | 回收站，可恢复或彻底删除 |

## 创作声明

每个稿件都有 `contentType`（`original` 原创、`repost` 转载、`ai` AI 生成）、转载时必填的 `sourceUrl`，以及 `aiGenerated` 标记。转载必须提供 `http(s)` 来源链接。公开视频页会展示声明、来源与 AI 标识；声明本身不改变可见性。

作者还可以按稿件关闭评论和弹幕。关闭后公开页隐藏发送区并显示关闭提示，API 也会拒绝该稿件的新评论或弹幕。

## 回收站

`DELETE /api/v1/studio/videos/:id` 通过 `status='deleted'` 与 `deletedAt` 把稿件移入回收站。恢复时根据是否曾发布回到 `published`、`ready` 或 `draft`。彻底删除仅限投稿人，会清理已存储的媒体且不可恢复。

## 审核申诉

被审核下架的稿件会在创作中心详情页显示申诉入口。同一稿件同时只能有一条待处理申诉。审核员在 `/admin/appeals` 处理；通过后稿件恢复为 `published`，写入状态记录、通知作者并记录审计；驳回则保留下架状态并附处理说明。

## 数据与隐私

`watch_events` 记录播放对应的分 P、来源、设备类型与国家；worker 每天按 UTC 汇总到 `video_daily_stats` 与 `creator_daily_stats`，同一天重跑会覆盖计数，保证幂等。创作中心只读取汇总表。

- 不向创作者暴露 IP、用户 ID 或单个观众记录。
- 地区只到 ISO 国家代码；中国省份仅用于 IP 属地展示，不参与访问控制。
- 来源与设备使用粗粒度分类（如 `home`、`search`、`related`，以及 `desktop`、`mobile`、`tablet`、`tv`、`bot`）。

原始 `watch_events` 遵循常规清理保留期（默认 180 天）；每日汇总长期保留。

## 联合投稿

联合投稿采用邀请-接受模型。投稿人按用户名或邮箱邀请，角色为 `coauthor`（合作者）或 `assistant`（协助者）；被邀请人在 `/studio/collaborations` 接受。接受后，成员可以在自己的创作中心打开并编辑该稿件，公开页也会署名。删除、彻底删除、发布与成员管理仍仅限投稿人。

## 专栏

专栏是保存在 `articles` 的长文，正文先经保守的 Markdown 子集渲染，再通过 `sanitizeRichHtml` 过滤。支持封面、摘要、分区、可见性、评论、点赞、收藏与评论管理。发布是否进入审核由 `review.articles` 决定；后台队列位于 `/admin/articles`。
