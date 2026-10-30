# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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

### Fixed

- Hide the installer entry point and every staff-console route from ordinary
  visitors: the public about page no longer links `/admin/install`, the
  installer redirects home once the instance is installed, non-staff accounts
  are sent to the studio instead of the console, and the console responds with
  `X-Robots-Tag: noindex`.
