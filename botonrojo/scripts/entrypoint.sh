#!/bin/sh
set -e

echo "[entrypoint] Running migrations..."
node scripts/migrate.mjs

echo "[entrypoint] Running seed (idempotent)..."
node scripts/seed.mjs

echo "[entrypoint] Starting server..."
exec node server.js
