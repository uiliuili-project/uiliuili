# Creator studio

> [简体中文](zh-CN/creator-studio.md)

The creator studio lives at `/studio` and is a multi-page workspace rather than
one upload form. On desktop the left rail is a sticky navigation; on narrow
screens the same entries become a horizontal tab strip.

## Pages

| Path | Purpose |
| --- | --- |
| `/studio` | Overview: recent videos, review state, quick actions |
| `/studio/videos` | All videos with search, filters, and status |
| `/studio/videos/new` | Standalone drag-and-drop upload page |
| `/studio/videos/:id` | Edit metadata, declaration, collaborators, appeal, status history |
| `/studio/analytics` | Views, interactions, sources, devices, countries, top videos |
| `/studio/comments` | Comment inbox with hide/restore/delete |
| `/studio/danmaku` | Danmaku inbox with hide/restore |
| `/studio/collections` | Collections and series, including item ordering |
| `/studio/columns` | Long-form columns and their editor |
| `/studio/fans` | Follower total, growth trend, recent followers |
| `/studio/growth` | Experience, level progress, badges, tasks |
| `/studio/messages` | Review, comment, follower, and collaboration notices |
| `/studio/collaborations` | Invitations to accept or reject |
| `/studio/appeals` | Appeal history and reviewer responses |
| `/studio/trash` | Soft-deleted videos, restore or permanently delete |

## Uploading a video

`/studio/videos/new` is a dedicated page designed like a Bilibili submission
screen. It is not a dialog over the video list.

1. Drop a video file anywhere on the page, or use the file picker. The first
   page only shows the drop zone and the accepted formats.
2. Dropping a file immediately creates a draft video and starts the upload; the
   page switches to the submission form and shows the same-page upload progress,
   speed, and remaining time.
3. While the upload runs, fill in title, description, category, tags, cover, and
   the creation declaration. The form is saved to the draft before publishing.
4. When the upload completes the page polls the video status. The subtitle
   follows the phase (`Uploading`, `Transcoding`, `Ready to publish`,
   `In review`), so a draft is never shown while transcoding is still running.
5. **Publish** saves the current form with a final `PATCH`, then calls the
   publish endpoint. Depending on `review.videos`, the result is published
   immediately or enters review.

Only the new-upload entry is highlighted on this page; `/studio/videos` and
`/studio/videos/:id` highlight the video management entry. **Discard
submission** moves the draft to the recycle bin instead of leaving an empty
video behind.

## Creation declaration

Every video carries `contentType` (`original`, `repost`, or `ai`), an optional
`sourceUrl` for reposts, and an `aiGenerated` flag. Reposts must provide an
`http(s)` source URL. The public video page shows the declaration, the source,
and an AI badge; the content type never changes visibility by itself.

Authors can also turn comments and danmaku off per video. The public page hides
the composer and shows a closed notice instead, while the API refuses new
comments/danmaku for that video.

## Recycle bin

`DELETE /api/v1/studio/videos/:id` moves a video to the recycle bin by setting
`status='deleted'` and `deletedAt`. Restoring returns it to `published`, `ready`,
or `draft` according to whether it was ever published. Permanent deletion is
owner-only, removes stored media, and cannot be undone.

## Review appeals

A video blocked by review shows an appeal box on its studio detail page. One
pending appeal per video is allowed. Reviewers see the queue under
`/admin/appeals`; accepting an appeal restores a blocked video to `published`,
writes a status-log entry, notifies the author, and records an audit entry.
Declining keeps the block and notifies the author with the handling note.

## Analytics and privacy

`watch_events` records the part, traffic source, device class, and country for a
playback. The worker rolls these up once a day (UTC) into `video_daily_stats`
and `creator_daily_stats`, which are idempotent per day. The studio only reads
the rolled-up tables.

- No IP address, user id, or per-viewer row is exposed to creators.
- Geography stops at ISO country code; Chinese provinces are display-only for
  IP location and are never used for access control.
- Sources and devices are coarse buckets (`home`, `search`, `related`, ... and
  `desktop`, `mobile`, `tablet`, `tv`, `bot`).

Raw `watch_events` follow the normal cleanup retention (180 days by default);
daily aggregates are kept long term.

## Collaborations

Collaboration is invite-and-accept. The owner invites a user by username or
email with role `coauthor` or `assistant`; the invitee accepts from
`/studio/collaborations`. Accepted collaborators can open and edit the video in
their own studio, and their names are credited on the public page. Delete,
purge, publishing, and collaborator management remain owner-only.

## Columns

Columns are long-form posts stored in `articles`, rendered from a conservative
Markdown subset, then passed through `sanitizeRichHtml`. They support a cover,
summary, category, visibility, comments, likes, favorites, and comment
moderation. Publishing may route through review depending on
`review.articles`; `/admin/articles` is the staff queue.
