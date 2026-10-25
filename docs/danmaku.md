# Danmaku

> [简体中文](zh-CN/danmaku.md)

## Data model

Danmaku is stored by video and 6-minute segment:

```text
video_id, segment (floor(progress_ms / 360000)), progress_ms
```

The client loads the current segment and preloads the next. Sending validates
login, mute status, rate limit, length, color, mode, and duplicate content.

## Real-time protocol

Socket.IO namespace `/danmaku`:

```text
join        { videoId }
leave       { videoId }
send        { videoId, progressMs, mode, color, fontSize, content }
sent        { id, progressMs, ... }
blocked     { reason }
viewers     { count }
```

Without Redis, broadcasting is process-local and the deployment should run one
API instance. With Redis, the Socket.IO Redis adapter broadcasts across
instances.

## Rendering

`@uiliuili/danmaku` provides a Canvas 2D engine with:

- scroll, top, and bottom modes;
- collision-aware lane allocation;
- pause/seek synchronization;
- opacity, font size, speed, display area, and block lists;
- high-DPI rendering;
- Bilibili XML import/export.

## Moderation

Administrators can hide/delete danmaku, manage blocked words, mute users, and
review reports. Shadow-hidden danmaku remains visible to its author only.
