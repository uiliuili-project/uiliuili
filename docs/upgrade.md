# Upgrade, backup, and restore

> [简体中文](zh-CN/upgrade.md)

## Upgrade

1. Back up the database, `.env`, `config/instance.json`, and local uploads.
2. Replace the application code with the new release.
3. Run `pnpm install && pnpm build`.
4. Run `pnpm cli migrate`.
5. Restart API, worker, web, and admin.

If migrations are pending, run `pnpm cli migrate`. If you downgrade the code,
restore a database backup taken before the upgrade.

### Upgrade center

**Admin → System** now includes an upgrade center that never replaces the
application code. It reports the database version, the running program version,
pending migrations, and the last five backups.

- **Create backup** runs `pg_dump --format=custom` into `storage/backups` and
  copies `.env` and `config/instance.json` next to it. The Docker image installs
  `postgresql-client`; native installs need `pg_dump` on `PATH`.
- **Run database upgrade** asks for the current program version as confirmation,
  creates a backup, briefly enables maintenance mode, runs every pending
  migration under the migration advisory lock, updates `app_instance.version`,
  and writes an audit log entry.
- The service restart is never arbitrary shell from the browser. Set
  `UPGRADE_RESTART_CMD` in the API environment to a fixed command such as
  `systemctl restart uiliuili-api uiliuili-worker`, and the upgrade center runs
  that command after a successful migration. Without it, the page asks the
  administrator to restart the API and worker manually.
- **Maintenance mode** can be toggled independently, which is useful before a
  manual code replacement. Visitors see the maintenance page while staff can
  still sign in.

Migration `0006` adds legal consent fields, AI moderation logs, comment/dynamic
moderation metadata, category presentation fields, and renames the default site
name from `uiliuili` to `萌悠` only when it is still the old default. Custom site
names are never overwritten.

## Region and restricted-content migration

Migration `0004` adds `users.region`, `users.region_source`,
`users.show_restricted`, and the video region fields. Existing accounts keep an
empty region, so their next request resolves a country from the configured
header, GeoIP database, or fallback. Administrators can correct individual
accounts from **Users**. Existing videos remain unrestricted; mark a video as
restricted or add a per-video block list from the creator center or the admin
video editor.

## Recovering the owner

Migration `0003` maps the previous `SUPER_ADMIN` account to the `OWNER` group
and backfills the other groups. If several `SUPER_ADMIN` accounts existed, only
the oldest stays owner and the rest become administrators.

If no owner can sign in, recover it from the server:

```bash
pnpm cli owner:promote --username owner --email owner@example.com
```

`admin:create` is an alias. The command replaces the current owner inside a
transaction. After signing in, transfer ownership from **Admin → Users → Make
owner** instead of editing the database.

## Backup

Back up:

- PostgreSQL database;
- `.env` (contains `APP_KEY` and database credentials);
- `config/instance.json`;
- local storage directory when using the local driver;
- S3 bucket contents when using S3.

Example:

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump
tar -czf uiliuili-config.tgz .env config/instance.json
tar -czf uiliuili-uploads.tgz storage/uploads
```

## Restore

1. Stop the API and worker.
2. Restore the database with `pg_restore`.
3. Restore `.env`, `config/instance.json`, and uploads.
4. Start the services.
5. Verify the admin system page and a sample video.

Test restores regularly. Without `APP_KEY`, encrypted S3, SMTP, and OAuth
secrets cannot be recovered.
