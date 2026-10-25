# 弹幕

> [English](../danmaku.md)

## 数据模型

弹幕按视频和 6 分钟分片存储：

```text
video_id, segment (floor(progress_ms / 360000)), progress_ms
```

客户端加载当前分片并预加载下一片。发送时会校验登录状态、禁言状态、频率限制、长度、颜色、模式和重复内容。

## 实时协议

Socket.IO 命名空间 `/danmaku`：

```text
join        { videoId }
leave       { videoId }
send        { videoId, progressMs, mode, color, fontSize, content }
sent        { id, progressMs, ... }
blocked     { reason }
viewers     { count }
```

未启用 Redis 时，广播只在本进程内生效，部署时应只运行一个 API 实例。启用 Redis 后，Socket.IO Redis Adapter 可以跨实例广播。

## 渲染

`@uiliuili/danmaku` 提供 Canvas 2D 引擎，支持：

- 滚动、顶部和底部模式；
- 碰撞检测与轨道分配；
- 暂停/拖动进度同步；
- 透明度、字号、速度、显示区域和屏蔽列表；
- 高 DPI 渲染；
- Bilibili XML 导入/导出。

## 审核

管理员可以隐藏/删除弹幕、管理屏蔽词、禁言用户并处理举报。被影子隐藏的弹幕仅作者本人可见。
