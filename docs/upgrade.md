# Upgrade, backup, and restore

> [简体中文](zh-CN/upgrade.md)

## Upgrade

Always back up first. The database, `.env`, `config/instance.json`, and local
uploads belong together; without `.env` the stored provider secrets cannot be
decrypted.

### Native deployment

```bash
# 1. Back up
pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
tar -czf config-$(date +%F).tgz .env config/instance.json
tar -czf uploads-$(date +%F).tgz storage/uploads

# 2. Update and build
git pull
corepack enable
pnpm install --frozen-lockfile
pnpm build

# 3. Apply migrations
pnpm cli migrate

# 4. Restart
sudo systemctl restart uiliuili-api uiliuili-worker uiliuili-web
```

The admin panel is static files served by Nginx from `apps/admin/dist`.
`pnpm build` regenerates it, so a browser refresh shows the new version;
restarting only the API does not update the panel.

`pnpm cli migrate` applies every pending migration. You can also open
**Admin → System → Upgrade center**, create a backup, and run the database
upgrade there.

### Docker

```bash
# 1. Back up the database and the app-data volume (commands below)
# 2. Update and rebuild
git pull
docker compose build
docker compose up -d
docker compose logs -f bootstrap
```

Application code and dependencies live in the images; persistent state is only
in `/data` and the database. `bootstrap` applies migrations before the API
starts. If it fails, the API and worker stay down; read
`docker compose logs bootstrap` first.

### Downgrade

Roll back the code, then restore the database backup taken before the upgrade:

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" backup.dump
```

Docker also needs the matching `app-data` restore. Data created after the
upgrade is lost; confirm before proceeding.

### Upgrade center

**Admin → System** includes an upgrade center that never replaces application
code. It reports the database version, the running program version, pending
migrations, and the last five backups.

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
  it after a successful migration. Without it, the page asks the administrator
  to restart the API and worker manually.
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

If no owner can sign in, recover it on the server:

```bash
# Native
pnpm cli owner:promote --username owner --email owner@example.com

# Docker
docker compose run --rm bootstrap node dist/index.js owner:promote \
  --username owner --email owner@example.com
```

`admin:create` is an alias. The command replaces the current owner inside a
transaction; without `--password`, it generates and prints a random password.
After signing in, transfer ownership from **Admin → Users → Make owner** instead
of editing the database.

## Backup

A native install needs:

- the PostgreSQL database;
- `.env` (contains `APP_KEY` and database credentials);
- `config/instance.json`;
- the local storage directory (`storage/uploads`);
- the S3 bucket when using S3.

```bash
pg_dump "$DATABASE_URL" -Fc -f backup.dump
tar -czf uiliuili-config.tgz .env config/instance.json
tar -czf uiliuili-uploads.tgz storage/uploads
```

`infra/scripts/backup.sh` loads `.env`, dumps the database, and archives the
config and uploads. Schedule it with cron:

```bash
sudo install -m 755 infra/scripts/backup.sh /usr/local/bin/uiliuili-backup
sudo /usr/local/bin/uiliuili-backup
```

Docker backup and restore commands are in
[Docker deployment · backup and restore](docker.md#backup-and-restore).

## Restore

1. Stop the API and worker.
2. Restore the database with `pg_restore`.
3. Restore `.env`, `config/instance.json`, and uploads.
4. Start the services.
5. Check the admin system page and play a sample video.

Test restores regularly. Without `APP_KEY`, encrypted S3, SMTP, OAuth, captcha,
and AI moderation secrets cannot be recovered.
