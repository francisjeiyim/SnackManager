#!/bin/sh
# Applies migrations, (re)asserts the seed (idempotent upserts), then starts
# the API. Runs on every container start, so a wiped DB self-heals on restart.
#
# Uses the local binaries directly — never `pnpm exec`, which would try to
# download pnpm via corepack at container start and fail without registry access.
set -e
cd /app/packages/server
BIN=./node_modules/.bin

echo "[entrypoint] prisma migrate deploy"
"$BIN/prisma" migrate deploy

echo "[entrypoint] seeding (idempotent)"
"$BIN/ts-node" prisma/seed.ts || echo "[entrypoint] WARN: seed failed — admin account may be missing"

echo "[entrypoint] starting SnackManager API on :${SERVER_PORT:-4100}"
exec node dist/main
