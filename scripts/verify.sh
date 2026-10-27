#!/usr/bin/env bash
# Pre-push deploy sanity check. Reproduces the two production builds locally and
# then boots the server against a throwaway database to confirm migrations +
# startup succeed — i.e. the exact things that, when broken, fail a deploy:
#   • server tsc build          → Railway build command
#   • client tsc -b + vite build → Netlify build command
#   • fresh-DB boot + /health    → Railway startup/healthcheck (catches a bad
#                                   migration or startup crash before it ships)
#
# It also runs the server unit tests. There are only a couple, deliberately:
# nameMatch and boardReplay are pure functions where a silent bug corrupts a
# recording nobody can make again, which is a different kind of risk from the
# rest of the codebase.
#
# Run `yarn verify` before pushing. It cannot catch purely environmental Railway
# failures (e.g. a flaky better-sqlite3 native compile), only code/migration ones.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Cleaning TS incremental cache…"
find . -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true

echo "▸ Building server (tsc — Railway build)…"
yarn workspace server build

echo "▸ Running server unit tests…"
yarn workspace server test

echo "▸ Building client (tsc -b && vite build — Netlify build)…"
yarn workspace client build

echo "▸ Booting server on a fresh DB to verify migrations + startup…"
TMP="$(mktemp -d)"
LOG="$TMP/server.log"
PORT=3971 DATABASE_PATH="$TMP/verify.sqlite" yarn workspace server start >"$LOG" 2>&1 &
PID=$!
ok=""
for _ in $(seq 1 45); do
  if curl -sf "http://localhost:3971/api/health" >/dev/null 2>&1; then ok=1; break; fi
  kill -0 "$PID" 2>/dev/null || break   # server process died
  sleep 1
done
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

if [ "$ok" != "1" ]; then
  echo "✗ Server failed to start / migrations failed on a fresh DB. Last log lines:"
  tail -30 "$LOG" 2>/dev/null || true
  exit 1
fi
rm -rf "$TMP"

echo ""
echo "✓ Verify passed — server build, client build, and fresh-DB migrations/startup all OK."
