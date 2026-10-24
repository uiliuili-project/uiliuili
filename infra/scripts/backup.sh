#!/usr/bin/env bash
set -euo pipefail

ROOT="${UILIUILI_ROOT:-/opt/uiliuili}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/uiliuili}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$ROOT/.env" ]]; then
    # shellcheck disable=SC1090
    set -a; source "$ROOT/.env"; set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not configured."
  exit 1
fi

pg_dump "$DATABASE_URL" -Fc -f "$BACKUP_DIR/db-$STAMP.dump"
tar -czf "$BACKUP_DIR/config-$STAMP.tgz" -C "$ROOT" .env config/instance.json 2>/dev/null || true
if [[ -d "$ROOT/storage/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$STAMP.tgz" -C "$ROOT" storage/uploads
fi

echo "Backup written to $BACKUP_DIR (timestamp $STAMP)."
