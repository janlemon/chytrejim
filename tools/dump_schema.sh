#!/usr/bin/env bash
set -euo pipefail

# Dumps the public DB schema into ./.schema/public_schema.sql
# Requirements: pg_dump in PATH and a Postgres connection URL.
#
# Configure one of:
# - SUPABASE_DB_URL (preferred): full Postgres URL incl. user + password
# - SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD: will build a Supabase URL
# - HOST/DB vars: SUPABASE_DB_HOST, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "Error: pg_dump not found. Install PostgreSQL client tools (pg_dump)." >&2
  exit 1
fi

mkdir -p .schema

DB_URL="${SUPABASE_DB_URL:-}"

if [[ -z "$DB_URL" && -n "${SUPABASE_PROJECT_REF:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
fi

if [[ -z "$DB_URL" && -n "${SUPABASE_DB_HOST:-}" && -n "${SUPABASE_DB_NAME:-}" && -n "${SUPABASE_DB_USER:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  DB_URL="postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:5432/${SUPABASE_DB_NAME}?sslmode=require"
fi

if [[ -z "$DB_URL" ]]; then
  cat >&2 <<EOF
Error: No database URL.
Set one of:
  - SUPABASE_DB_URL
  - SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD
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
