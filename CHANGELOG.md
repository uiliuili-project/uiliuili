# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- One-command Docker quickstart (`scripts/quickstart.sh`): creates `.env`,
  generates `APP_KEY` and `DB_PASSWORD`, builds and starts the stack, waits for
  health, and prints the owner claim token.
- `GET /health` and `GET /health/live` service endpoints, proxied by the Docker
  gateway and the provided Nginx config.
- Optional external video nodes (`apps/video-node`,
  `@uiliuili/video-node-contract`): signed upload/transcode/playback on another
  host, with admin registration, routing strategies, and replication jobs.
- Standalone submission page at `/studio/videos/new`: drop a file to create a
  draft and upload immediately, with same-page XHR progress, speed, remaining
  time, and phase-aware status text.
- Site-wide motion layer gated by `data-motion` and `prefers-reduced-motion`,
  plus browser-version detection with a static upgrade notice for unsupported
  engines.
- Complete English translations for the creator studio navigation and upload
  flow.
- Initial monorepo foundation.
- Self-hosted first-run web installer.
- Video upload, FFmpeg HLS transcoding, danmaku, social features, search,
  recommendations, and admin panel.
- Cloudflare Turnstile and reCAPTCHA v2/v3 captcha, with per-action
  soft/hard rate limits and automatic retry after a captcha pass.
- OpenAI-compatible AI moderation for comments and dynamics, with review
  verdicts, a pending queue, logs, caching, and configurable failure handling.
- Editable terms of service and privacy policy, registration consent tracking,
  custom navigation/footer buttons, custom header/footer HTML, GA4, and a
  network-country badge next to the logo.
- Category icons, descriptions, visibility, and ordering controls.
- Admin upgrade center with database backups, advisory-locked migrations,
  maintenance mode, and an optional fixed restart command.
- Site rebrand to 萌悠 (MoeYou); internal `uiliuili` identifiers are unchanged.
- Creator studio rebuilt as a multi-page workspace: overview, video management,
  video editing, analytics, comments, danmaku, collections, columns, fans,
  growth, messages, collaborations, appeals, and a recycle bin.
- Recycle bin with restore and permanent deletion. Deletion remains a soft
  delete; restore returns published videos to `published`, unpublished ones to
  `ready`, and drafts to `draft`.
- Review appeals: one pending appeal per video, reviewer queue in the admin
  console, automatic restoration when accepted, status logs, notifications, and
  audit entries.
- Creation declarations (`original`, `repost`, `ai`), required repost source
  links, an AI-generated badge, and per-video comment/danmaku switches enforced
  by the API and reflected on the public page.
- Anonymous playback aggregation: `watch_events` now records part, source,
  device, and country; a worker rollup writes idempotent UTC daily rows to
  `video_daily_stats` and `creator_daily_stats` for the studio analytics page.
- Long-form columns stored in `articles`, rendered from a safe Markdown subset,
  with public listing/detail pages, likes, favorites, comments, studio CRUD,
  and an admin review queue.
- Collaborations: invite by username or email, accept/reject, shared studio
  access for accepted members, and public credit, while destructive actions stay
  with the video owner.
- Collections and series management, follower/growth dashboards, studio
  message center, and an admin appeals/columns console.

### Changed

- Documentation reorganized by task: install, deploy, configure, operate, and
  develop, with Chinese and English indexes and new troubleshooting and
  development guides.
- Installation simplified to two clear paths: Docker quickstart and native
  install. Docker is documented as the recommended fast path; systemd now runs
  Next.js directly instead of depending on a global pnpm shim.
- The default Docker site name is 萌悠, and the native `.env.example` keeps
  `INSTALL_ALLOW_LOCALHOST=false`.
- CI runs on both `main` and `master`.

### Fixed

- The management console can delete a user again. The action keeps the same
  owner/admin/self guards as editing, removes the account and all cascading
  content in one operation, cleans the user's stored media, and writes an audit
  entry.
- Hide the installer entry point and every staff-console route from ordinary
  visitors: the public about page no longer links `/admin/install`, the
  installer redirects home once the instance is installed, non-staff accounts
  are sent to the studio instead of the console, and the console responds with
  `X-Robots-Tag: noindex`.
- In account settings, a region blocked by the site policy now only shows the
  resolved region; the restricted-content switch is not offered there.
- IP location for Chinese content resolves to the province (for example 浙江)
  when a MaxMind GeoLite2-City database or a `region.provinceHeader` is
  configured; other countries and unknown provinces keep showing the country.
  Provinces are display-only and never affect region policy.
- Maintenance mode is rendered on the server, so visitors without JavaScript
  and crawlers see the notice, while reviewers, administrators and the owner
  keep full access to the site instead of being locked out.
- Rate limit settings reject a hard threshold that is not above the soft
  threshold, which would otherwise skip the captcha step entirely; the admin
  form validates the same rule before saving.
- The manual update check defaults to the project repository
  (`uiliuili-project/uiliuili`) instead of a non-existent one.
- Queue retry/cancel and search reindex controls are disabled for accounts
  without `system:operate` instead of failing with a permission error.
- The management console shows the captcha challenge and retries a challenged
  request, so enabling captcha for login no longer locks staff out of
  `/admin/`.
