#!/usr/bin/env bash
set -euo pipefail

# Dumps the public DB schema into ./.schema/public_schema.sql
# Requirements: pg_dump in PATH and a Postgres connection URL.
#
# Configure one of:
# - SUPABASE_DB_URL (preferred): full Postgres URL incl. user + password
# - SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD: will build a Supabase URL
# - HOST/DB vars: SUPABASE_DB_HOST, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD
#
# Convenience: this script will auto-load env files if present, in order:
#   .env.db, .env.local, .env

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump not found. Install PostgreSQL client tools (pg_dump)." >&2
  exit 1
fi

mkdir -p .schema

# Auto-load environment files if present
for f in .env.db .env.local .env; do
  if [[ -f "$f" ]]; then
    # shellcheck disable=SC1090
    set -a; . "$f"; set +a
  fi
done

DB_URL="${SUPABASE_DB_URL:-}"

# Derive PROJECT_REF from EXPO_PUBLIC_SUPABASE_URL if not provided
if [[ -z "${SUPABASE_PROJECT_REF:-}" && -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ]]; then
  # Examples: https://wjhfcaynarzkqzvekzaf.supabase.co
  SUPABASE_PROJECT_REF="$(echo "$EXPO_PUBLIC_SUPABASE_URL" | sed -E 's|https?://([^.]+)\.supabase\.co.*|\1|')"
fi

# Interactive prompts (only when run in a TTY) to make setup easier
if [[ -z "$DB_URL" && -t 0 ]]; then
  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    read -r -p "Enter SUPABASE_PROJECT_REF (e.g. wjhfcaynarzkqzvekzaf): " SUPABASE_PROJECT_REF || true
  fi
  if [[ -n "${SUPABASE_PROJECT_REF:-}" && -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    read -s -p "Enter database password for project ${SUPABASE_PROJECT_REF}: " SUPABASE_DB_PASSWORD || true
    echo ""
  fi
fi

if [[ -z "$DB_URL" && -n "${SUPABASE_PROJECT_REF:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
fi

if [[ -z "$DB_URL" && -n "${SUPABASE_DB_HOST:-}" && -n "${SUPABASE_DB_NAME:-}" && -n "${SUPABASE_DB_USER:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  DB_URL="postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:5432/${SUPABASE_DB_NAME}?sslmode=require"
fi

# As a last interactive fallback, allow entering full DB URL
if [[ -z "$DB_URL" && -t 0 ]]; then
  read -r -p "Enter full SUPABASE_DB_URL (or leave empty to abort): " DB_URL || true
fi

if [[ -z "$DB_URL" ]]; then
  cat >&2 <<EOF
Error: No database URL.
Set one of:
  - SUPABASE_DB_URL
  - SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD (or set EXPO_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD)
  - SUPABASE_DB_HOST, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD
EOF
  exit 1
fi

OUT="${OUT_PATH:-${1:-.schema/public_schema.sql}}"
mkdir -p "$(dirname "$OUT")"
echo "Dumping schema to ${OUT}…"

pg_dump \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
  --file "$OUT" \
  "$DB_URL"

echo "Done. File updated: ${OUT}"
