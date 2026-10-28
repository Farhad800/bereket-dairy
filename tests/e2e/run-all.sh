#!/usr/bin/env bash
# Runs every dairy end-to-end suite, each on a FRESH LOCAL test database with its own server on :3001.
# Never touches a live database: the URL below is checked to be localhost.
# Needs: a production build (npm run build), PostgreSQL running locally, Python 3 + Playwright.
#   bash tests/e2e/run-all.sh            # all suites
#   bash tests/e2e/run-all.sh dairy      # one suite
set -uo pipefail
cd "$(dirname "$0")/../.."
URL="postgresql://dairy:dairy_dev@localhost:5432/dairy_accept"
case "$URL" in *localhost*) ;; *) echo "refusing: not a local database"; exit 1;; esac
LOG=${TMPDIR:-/tmp}/dairy-e2e; mkdir -p "$LOG"
PID=""
stop() {
  [ -n "$PID" ] && kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null; PID=""
  fuser -k 3001/tcp >/dev/null 2>&1 || true   # npx leaves the real server running: free the port
  for _ in $(seq 1 30); do curl -s -o /dev/null http://localhost:3001 || return 0; sleep 0.5; done
}
trap stop EXIT
start() { # $@ = extra env
  stop
  env DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL SETUP_TOKEN=dairy-setup-token-2026 FACTORY_TIMEZONE=Asia/Baghdad "$@" npx next start -p 3001 >"$LOG/server.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3001/api/health && return 0; sleep 1; done
  echo "server did not start"; return 1
}
fresh() { stop; bash tests/e2e/reset-dairy-db.sh >/dev/null 2>&1; }
demo() { DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL npx tsx scripts/demo-data.ts add >/dev/null 2>&1; }
suite() { # name, python file
  local out; out=$(python3 "tests/e2e/$2" 2>&1); echo "$out" >"$LOG/$1.txt"
  echo "$1: $(echo "$out" | grep -E '^[0-9]+/[0-9]+ passed' | tail -1)"
  echo "$out" | grep '^FAIL' | sed 's/^/    /'
}
ONLY=${1:-}
run() { [ -z "$ONLY" ] || [ "$ONLY" = "$1" ]; }

if run dairy;        then fresh; start; suite dairy dairy.py; demo; suite security security.py; fi
if run fifo;         then fresh; start; suite fifo dairy-fifo.py; fi
for s in m3-m4 stock-docs customers safe safes receipts review-fixes; do
  if run "$s"; then fresh; start; suite "$s" "$s.py"; fi
done
if run stage1; then
  stop; bash tests/e2e/reset-dairy-db.sh >/dev/null 2>&1
  DATABASE_URL=$URL DATABASE_URL_UNPOOLED=$URL ADMIN_USERNAME=admin ADMIN_PASSWORD=AdminDev2026 npx tsx prisma/seed.ts >/dev/null 2>&1
  demo; start; suite stage1 stage1.py
fi
echo "logs: $LOG"
