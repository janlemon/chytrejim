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

# Interactive builder (TTY only): build DB_URL from known patterns so you only enter a password
if [[ -z "$DB_URL" && -t 0 ]]; then
  # 1) Project ref
  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    read -r -p "Enter SUPABASE_PROJECT_REF (e.g. wjhfcaynarzkqzvekzaf): " SUPABASE_PROJECT_REF || true
  fi
  # Try to infer from https URL if still empty
  if [[ -z "${SUPABASE_PROJECT_REF:-}" && -n "${EXPO_PUBLIC_SUPABASE_URL:-}" ]]; then
    SUPABASE_PROJECT_REF="$(echo "$EXPO_PUBLIC_SUPABASE_URL" | sed -E 's|https?://([^.]+)\.supabase\.co.*|\1|')"
  fi

  # 2) Connection type
  if [[ -n "${SUPABASE_PROJECT_REF:-}" && -z "$DB_URL" ]]; then
    echo "Select connection type:"
    echo "  1) Session pooler (recommended)"
    echo "  2) Transaction pooler"
    echo "  3) Direct (db.${SUPABASE_PROJECT_REF}.supabase.co)"
    read -r -p "Choice [1/2/3] (default 1): " CHOICE || true
    CHOICE=${CHOICE:-1}

    # 3) Password (hidden)
    if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
      read -s -p "Enter database password for project ${SUPABASE_PROJECT_REF}: " SUPABASE_DB_PASSWORD || true
      echo ""
    fi

    # URL-encode password safely
    if command -v python3 >/dev/null 2>&1; then
      ENC_PW=$(python3 - <<PY
import os, urllib.parse
print(urllib.parse.quote(os.environ.get('SUPABASE_DB_PASSWORD','')))
PY
)
    else
      ENC_PW="$SUPABASE_DB_PASSWORD"
    fi

    # 4) Build URL
    case "$CHOICE" in
      2)
        # Transaction pooler
        PHOST="${SUPABASE_DB_POOLER_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
        DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENC_PW}@${PHOST}:6543/postgres?sslmode=require"
        ;;
      3)
        # Direct host
        DB_URL="postgresql://postgres:${ENC_PW}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
        ;;
      *)
        # Session pooler (default)
        PHOST="${SUPABASE_DB_POOLER_HOST:-aws-1-eu-central-1.pooler.supabase.com}"
        DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENC_PW}@${PHOST}:5432/postgres?sslmode=require"
        ;;
    esac
    echo "Using ${DB_URL%%:*}://***:***@$(echo "$DB_URL" | sed -E 's|^[a-z]+://([^@]+@)?||; s|\?.*$||')"
  fi
fi

if [[ -z "$DB_URL" && -n "${SUPABASE_PROJECT_REF:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  # URL-encode password to be safe
  if command -v python3 >/dev/null 2>&1; then
    ENC_PW=$(python3 - <<PY
import os, urllib.parse
print(urllib.parse.quote(os.environ.get('SUPABASE_DB_PASSWORD','')))
PY
)
  else
    ENC_PW="$SUPABASE_DB_PASSWORD"
  fi
  DB_URL="postgresql://postgres:${ENC_PW}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
fi

if [[ -z "$DB_URL" && -n "${SUPABASE_DB_HOST:-}" && -n "${SUPABASE_DB_NAME:-}" && -n "${SUPABASE_DB_USER:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  DB_URL="postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:5432/${SUPABASE_DB_NAME}?sslmode=require"
fi

# Pooler: if host/user/password set, prefer these (unless DB_URL already defined)
if [[ -z "$DB_URL" && -n "${SUPABASE_DB_POOLER_HOST:-}" && -n "${SUPABASE_DB_POOLER_USER:-}" && -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  POOL_PORT="${SUPABASE_DB_POOLER_PORT:-5432}"
  if command -v python3 >/dev/null 2>&1; then
    ENC_PW=$(python3 - <<PY
import os, urllib.parse
print(urllib.parse.quote(os.environ.get('SUPABASE_DB_PASSWORD','')))
PY
)
  else
    ENC_PW="$SUPABASE_DB_PASSWORD"
  fi
  DB_URL="postgresql://${SUPABASE_DB_POOLER_USER}:${ENC_PW}@${SUPABASE_DB_POOLER_HOST}:${POOL_PORT}/postgres?sslmode=require"
fi

# Preflight DNS resolution check; if it fails and we're in a TTY, offer to enter full URL
EXTRACT_HOST() { sed -E 's|^[a-z]+://([^@]+@)?([^:/?]+).*|\2|'; }
HOST="$(printf '%s' "$DB_URL" | EXTRACT_HOST || true)"
if [[ -n "$DB_URL" && -n "$HOST" ]]; then
  RESOLVED_OK=0
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<PY "$HOST" >/dev/null 2>&1 || RESOLVED_OK=1
import socket, sys
socket.gethostbyname(sys.argv[1])
PY
  else
    # Best-effort using nslookup/dig
    if command -v nslookup >/dev/null 2>&1; then
      nslookup "$HOST" >/dev/null 2>&1 || RESOLVED_OK=1
    elif command -v dig >/dev/null 2>&1; then
      dig +short "$HOST" | grep -qE '.' || RESOLVED_OK=1
    fi
  fi
  if [[ $RESOLVED_OK -ne 0 && -t 0 ]]; then
    echo "Warning: cannot resolve host '$HOST'."
    read -r -p "Enter full SUPABASE_DB_URL (postgresql://...) or paste your https://<ref>.supabase.co: " ALT_URL || true
    if [[ -n "$ALT_URL" ]]; then
      if [[ "$ALT_URL" =~ ^https?://([^.]+)\.supabase\.co ]]; then
        SUPABASE_PROJECT_REF="${BASH_REMATCH[1]}"
        # Ensure we have password
        if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
          read -s -p "Enter database password for project ${SUPABASE_PROJECT_REF}: " SUPABASE_DB_PASSWORD || true
          echo ""
        fi
        # Prefer pooler if available via env, otherwise use direct host
        if [[ -n "${SUPABASE_DB_POOLER_HOST:-}" ]]; then
          POOL_PORT="${SUPABASE_DB_POOLER_PORT:-5432}"
          if command -v python3 >/dev/null 2>&1; then
            ENC_PW=$(python3 - <<PY
import os, urllib.parse
print(urllib.parse.quote(os.environ.get('SUPABASE_DB_PASSWORD','')))
PY
)
          else
            ENC_PW="$SUPABASE_DB_PASSWORD"
          fi
          DB_URL="postgresql://postgres.${SUPABASE_PROJECT_REF}:${ENC_PW}@${SUPABASE_DB_POOLER_HOST}:${POOL_PORT}/postgres?sslmode=require"
        else
          if command -v python3 >/dev/null 2>&1; then
            ENC_PW=$(python3 - <<PY
import os, urllib.parse
print(urllib.parse.quote(os.environ.get('SUPABASE_DB_PASSWORD','')))
PY
)
          else
            ENC_PW="$SUPABASE_DB_PASSWORD"
          fi
          DB_URL="postgresql://postgres:${ENC_PW}@db.${SUPABASE_PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"
        fi
        echo "Derived Postgres URL for project '${SUPABASE_PROJECT_REF}'."
      else
        DB_URL="$ALT_URL"
      fi
    fi
  fi
fi

# As a last interactive fallback, allow entering full DB URL
if [[ -z "$DB_URL" && -t 0 ]]; then
  read -r -p "Enter full SUPABASE_DB_URL (postgresql://...) or leave empty to abort: " DB_URL || true
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
