#!/usr/bin/env bash
# 萌悠 (MoeYou) Docker quickstart.
#
# Creates .env with generated secrets when needed, builds the images, starts the
# Compose stack, waits for the health endpoint, and prints the site URL plus the
# one-time owner claim token from the first installation.
#
# Usage:
#   ./scripts/quickstart.sh
#   ./scripts/quickstart.sh --port 9090
#   ./scripts/quickstart.sh --no-build
#   ENV_FILE=/path/to/.env ./scripts/quickstart.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env}"
PORT="${GATEWAY_PORT:-}"
NO_BUILD=0

usage() {
  cat <<'EOF'
Usage: ./scripts/quickstart.sh [options]

Options:
  --port <port>   Publish the gateway on <port> and update APP_URL.
  --no-build      Start existing images instead of rebuilding them.
  -h, --help      Show this help.

Environment:
  ENV_FILE        Compose environment file (default: ./.env)
  COMPOSE_PROJECT_NAME  Compose project name (default: from .env)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      [[ $# -ge 2 ]] || { echo "--port needs a value." >&2; exit 2; }
      PORT="$2"
      shift 2
      ;;
    --no-build)
      NO_BUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command in docker curl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required (docker compose version failed)." >&2
  exit 1
fi

env_value() {
  local key="$1"
  awk -v key="$key" '
    index($0, key "=") == 1 {
      sub("^" key "=", "")
      print
      exit
    }
  ' "$ENV_FILE"
}

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

gen_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v node >/dev/null 2>&1; then
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  else
    echo "openssl or node is required to generate APP_KEY." >&2
    exit 1
  fi
}

gen_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
  elif command -v node >/dev/null 2>&1; then
    node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))"
  else
    echo "openssl or node is required to generate DB_PASSWORD." >&2
    exit 1
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  cp docker/.env.example "$ENV_FILE"
  echo "Created $ENV_FILE from docker/.env.example."
fi
chmod 600 "$ENV_FILE"

app_key="$(env_value APP_KEY)"
if [[ -z "$app_key" ]]; then
  app_key="$(gen_hex)"
  set_env APP_KEY "$app_key"
  echo "Generated APP_KEY."
fi
if [[ ! "$app_key" =~ ^[0-9a-fA-F]{64}$ ]]; then
  echo "APP_KEY in $ENV_FILE must be 64 hex characters (32 bytes)." >&2
  echo "Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

db_password="$(env_value DB_PASSWORD)"
if [[ -z "$db_password" ]]; then
  db_password="$(gen_password)"
  set_env DB_PASSWORD "$db_password"
  echo "Generated DB_PASSWORD."
fi

if [[ -n "$PORT" ]]; then
  if [[ ! "$PORT" =~ ^[0-9]+$ ]] || ((PORT < 1 || PORT > 65535)); then
    echo "Invalid port: $PORT" >&2
    exit 2
  fi
  set_env GATEWAY_PORT "$PORT"
  set_env APP_URL "http://localhost:$PORT"
fi

gateway_port="${PORT:-$(env_value GATEWAY_PORT)}"
gateway_port="${gateway_port:-8080}"
app_url="${APP_URL:-$(env_value APP_URL)}"
app_url="${app_url:-http://localhost:$gateway_port}"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$ROOT/compose.yaml")
if [[ -n "${COMPOSE_PROJECT_NAME:-}" ]]; then
  COMPOSE+=(-p "$COMPOSE_PROJECT_NAME")
fi

echo
echo "Starting 萌悠 (MoeYou)…"
started_at="$(date +%s)"
if [[ "$NO_BUILD" -eq 1 ]]; then
  "${COMPOSE[@]}" up -d
else
  "${COMPOSE[@]}" up -d --build
fi

health_url="http://127.0.0.1:${gateway_port}/health"
healthy=0
for _ in $(seq 1 120); do
  if [[ "$(curl -fsS -o /dev/null -w '%{http_code}' "$health_url" 2>/dev/null || true)" == "200" ]]; then
    healthy=1
    break
  fi
  bootstrap_id="$("${COMPOSE[@]}" ps -q bootstrap 2>/dev/null || true)"
  if [[ -n "$bootstrap_id" ]]; then
    state="$(docker inspect -f '{{.State.Status}}:{{.State.ExitCode}}' "$bootstrap_id" 2>/dev/null || true)"
    if [[ "$state" == exited:* && "$state" != "exited:0" ]]; then
      echo
      echo "The one-shot bootstrap container failed ($state)." >&2
      "${COMPOSE[@]}" logs --no-color --tail=80 bootstrap >&2 || true
      echo
      echo "Fix the error above, then run this script again." >&2
      exit 1
    fi
  fi
  sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
  echo
  echo "The stack did not become healthy in time." >&2
  "${COMPOSE[@]}" ps >&2 || true
  "${COMPOSE[@]}" logs --no-color --tail=80 bootstrap api web gateway >&2 || true
  echo
  echo "Inspect logs with: docker compose logs -f bootstrap api web" >&2
  exit 1
fi

bootstrap_logs="$("${COMPOSE[@]}" logs --no-color --since "$started_at" bootstrap 2>/dev/null || true)"
claim_token="$(printf '%s\n' "$bootstrap_logs" | sed -n 's/.*站长认领码：//p' | tail -n 1 | tr -d '\r')"

setup_status="$(curl -fsS "http://127.0.0.1:${gateway_port}/api/v1/auth/setup-status" 2>/dev/null || true)"
needs_owner=0
if printf '%s' "$setup_status" | grep -Eq '"needsOwner"[[:space:]]*:[[:space:]]*true'; then
  needs_owner=1
fi

echo
echo "萌悠 (MoeYou) is running."
echo "  Site:   $app_url"
echo "  Admin:  ${app_url%/}/admin/"
echo "  Health: $health_url"
if [[ -n "$claim_token" ]]; then
  echo
  echo "  站长认领码 / Owner claim token:"
  echo "    $claim_token"
  echo "  Register the first account in the browser and paste this token."
  echo "  It is shown once; store it now. If it is lost, use owner:promote."
elif [[ "$needs_owner" -eq 1 ]]; then
  echo
  echo "The instance is installed, but the owner account has not been created yet."
  echo "The claim token was printed during the first install and is not stored in plain text."
  echo "If you lost it, recover the owner with:"
  echo "  docker compose run --rm bootstrap node dist/index.js owner:promote --username owner --email owner@example.com"
else
  echo
  echo "This instance is already installed; no claim token is needed."
fi
echo
echo "Next: open the site, register the first account, then sign in to /admin/."
echo "Logs: docker compose logs -f api worker web"
echo "Stop: docker compose down"
