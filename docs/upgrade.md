# Upgrade, backup, and restore

## Upgrade

1. Back up the database, `.env`, `config/instance.json`, and local uploads.
2. Replace the application code with the new release.
3. Run `pnpm install && pnpm build`.
4. Run `pnpm cli migrate`.
5. Restart API, worker, web, and admin.

If migrations are pending, run `pnpm cli migrate`. If you downgrade the code,
restore a database backup taken before the upgrade.

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
