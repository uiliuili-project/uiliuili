# MoeYou documentation

> [简体中文](zh-CN/README.md)

MoeYou (萌悠) is an open-source, self-hosted danmaku video platform. The
repository, package scope, CLI, environment prefixes, and database schema keep
the name `uiliuili`; only the product name is MoeYou.

## Start here

| Goal | Document |
| --- | --- |
| Install with Docker in one command | [Docker deployment](docker.md) |
| Install directly on a server | [Installation](installation.md) |
| Configure Nginx, systemd, and capacity | [Native deployment](deployment.md) |
| Change environment variables or site settings | [Configuration](configuration.md) |
| Upgrade, back up, or restore | [Upgrade and backup](upgrade.md) |
| Fix a failed install or runtime problem | [Troubleshooting](troubleshooting.md) |

## Develop and extend

| Goal | Document |
| --- | --- |
| Set up a local development environment | [Development](development.md) |
| Understand processes, packages, and request paths | [Architecture](architecture.md) |
| Call the REST API or connect to WebSocket | [API overview](api.md) |
| Work with the upload and review workflow | [Creator studio](creator-studio.md) |
| Understand danmaku storage and rendering | [Danmaku](danmaku.md) |
| Configure SMTP and OAuth | [Mail and OAuth](oauth.md) |
| Use S3-compatible object storage | [S3 storage](s3.md) |

## Requirements at a glance

| Component | Requirement |
| --- | --- |
| Node.js | 22 or newer |
| PostgreSQL | 16 or newer (15 works with warnings) |
| FFmpeg / ffprobe | 6 or newer; 7 recommended, included in the Docker image |
| Optional | Redis 7, Meilisearch 1.x, S3-compatible storage, SMTP, OAuth |
| License | MIT |

The interface defaults to Simplified Chinese and ships a complete English
translation. The creator studio lives at `/studio`; the admin console lives at
`/admin/`. Both are entered according to the user group stored in the database.

## Getting help

- Search [troubleshooting](troubleshooting.md) first.
- Open an issue with the
  [bug report template](https://github.com/uiliuili-project/uiliuili/issues/new/choose).
- Report security problems privately as described in
  [SECURITY.md](../SECURITY.md).
