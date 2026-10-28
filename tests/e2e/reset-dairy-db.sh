#!/usr/bin/env bash
# Recreates the empty LOCAL test database for the dairy acceptance tests (never a live database).
# Stop the test server first (it holds connections), run this, then start it again:
#   DATABASE_URL=postgresql://dairy:dairy_dev@localhost:5432/dairy_accept DATABASE_URL_UNPOOLED=$DATABASE_URL \
#   SETUP_TOKEN=dairy-setup-token-2026 npx next start -p 3001
set -euo pipefail
DB=${PGDB:-dairy_accept}
URL="postgresql://dairy:dairy_dev@localhost:5432/$DB"
case "$URL" in *localhost*) ;; *) echo "refusing: not a local database"; exit 1;; esac
su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS $DB WITH (FORCE)' -c 'CREATE DATABASE $DB OWNER dairy'"
DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL npx prisma migrate deploy >/dev/null
DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL SEED_SKIP_ADMIN=1 npx tsx prisma/seed.ts >/dev/null
rm -rf .uploads/acceptance 2>/dev/null || true
echo "fresh database $DB ready"
