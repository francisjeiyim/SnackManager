#!/bin/sh
# Applies migrations, (re)asserts the seed (idempotent upserts), then starts
# the API. Runs on every container start, so a wiped DB self-heals on restart.
set -e
cd /app/packages/server

echo "[entrypoint] prisma migrate deploy"
pnpm exec prisma migrate deploy

echo "[entrypoint] prisma db seed (idempotent)"
pnpm exec prisma db seed || echo "[entrypoint] WARN: seed failed — continuing (admin account may be missing)"

echo "[entrypoint] starting SnackManager API on :${SERVER_PORT:-4100}"
exec node dist/main
