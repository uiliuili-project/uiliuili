#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root."
  exit 1
fi

echo "Installing PostgreSQL, Redis, FFmpeg, and curl…"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql redis-server ffmpeg curl ca-certificates

systemctl enable --now postgresql
systemctl enable --now redis-server

echo
echo "Services installed."
echo "Create a database and user, for example:"
echo "  sudo -u postgres psql -c \"CREATE USER uiliuili WITH PASSWORD 'change-me';\""
echo "  sudo -u postgres psql -c \"CREATE DATABASE uiliuili OWNER uiliuili;\""
echo
echo "Optional Meilisearch:"
echo "  https://www.meilisearch.com/docs/learn/getting_started/installation"
echo
echo "Then clone/build uiliuili and run the web installer."
