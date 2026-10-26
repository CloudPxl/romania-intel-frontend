#!/usr/bin/env bash
# Production build and cut-over, run on the VPS by .github/workflows/deploy-frontend.yml.
#
#   scripts/deploy-build.sh            build, swap in, restart, verify (rolls back on failure)
#   scripts/deploy-build.sh rollback   put the previous build back and restart
#
# `next build` used to write straight into .next while the live server was
# reading it: for the minutes a build takes, pages could load chunks from
# the half-written new build, a failed build left .next broken, and there
# was nothing to go back to. Now the build goes to .next-staging
# (next.config.mjs reads NEXT_DIST_DIR), the live .next is untouched until
# the build has exited 0 and passed the checks below, and the swap is two
# renames. The build it replaced stays as .next-prev for `rollback`.
set -euo pipefail
cd "$(dirname "$0")/.."

LIVE=.next
STAGING=.next-staging
PREV=.next-prev
UNIT=${FRONTEND_UNIT:-ro-intel-frontend}
SERVICE_USER=${SERVICE_USER:-rointel}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/}

sha() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }

restart_and_check() {
  if ! command -v systemctl >/dev/null || ! systemctl cat "$UNIT" >/dev/null 2>&1; then
    echo "no $UNIT unit on this machine; not restarting"
    return 0
  fi
  systemctl restart "$UNIT"
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "$HEALTH_URL" && { systemctl is-active "$UNIT"; return 0; }
    sleep 1
  done
  journalctl -u "$UNIT" -n 30 --no-pager || true
  return 1
}

# Swaps $LIVE and $1 (two renames, no copy).
exchange() {
  mv "$LIVE" "$LIVE.swap"
  mv "$1" "$LIVE"
  mv "$LIVE.swap" "$1"
}

rollback() {
  [ -d "$PREV" ] || { echo "no $PREV to roll back to"; exit 1; }
  exchange "$PREV"
  echo "rolled back to build $(cat "$LIVE/BUILD_ID")"
  restart_and_check
}

if [ "${1:-}" = rollback ]; then rollback; exit; fi

# Dependencies only when the lockfile changed. npm ci empties node_modules
# first, which the running server also loads from, so skipping it on the
# usual deploy (code only) keeps that window closed.
lock=$(sha package-lock.json)
if [ "$(cat node_modules/.deploy-lock-sha 2>/dev/null || true)" != "$lock" ]; then
  npm ci
  echo "$lock" > node_modules/.deploy-lock-sha
fi

# A build with another distDir rewrites these two tracked files to point at
# it; put them back however the build ends.
keep=$(mktemp -d)
cp tsconfig.json next-env.d.ts "$keep/"
trap 'cp "$keep/tsconfig.json" "$keep/next-env.d.ts" . && rm -rf "$keep"' EXIT

rm -rf "$STAGING"
NEXT_DIST_DIR=$STAGING npm run build
for f in BUILD_ID routes-manifest.json prerender-manifest.json server static; do
  [ -e "$STAGING/$f" ] || { echo "build incomplete: $STAGING/$f missing; live build untouched"; exit 1; }
done

# The service (unprivileged since deploy/vps/harden.sh) writes its cache
# under .next.
if [ "$(id -u)" = 0 ] && id "$SERVICE_USER" >/dev/null 2>&1; then
  chown -R "$SERVICE_USER:$SERVICE_USER" "$STAGING"
fi

if [ -d "$LIVE" ]; then
  rm -rf "$PREV"
  mv "$LIVE" "$PREV"
fi
mv "$STAGING" "$LIVE"
echo "build $(cat "$LIVE/BUILD_ID") is live"

if ! restart_and_check; then
  echo "new build did not answer on $HEALTH_URL — rolling back"
  rollback
  exit 1
fi
