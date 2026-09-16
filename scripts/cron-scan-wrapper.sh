#!/usr/bin/env bash
# Wrapper for launchd — loads env, ensures Postgres, runs scan.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Load secrets / DATABASE_URL
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
elif [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# Start local Postgres if Docker is available (no-op if already running)
if command -v docker >/dev/null 2>&1; then
  docker compose up -d 2>/dev/null || true
fi

export PATH="/usr/local/bin:/opt/homebrew/bin:${PATH}"

exec npx tsx scripts/cron-scan.ts
