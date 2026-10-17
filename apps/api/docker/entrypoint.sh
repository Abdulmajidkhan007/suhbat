#!/bin/sh
# API konteyneri kirish nuqtasi.
# Railway Volume root egaligida ulanadi; root sifatida ishga tushirilsa
# (Railway: RAILWAY_RUN_UID=0) media papkasini `node` ga beradi va huquqni
# darhol `node` foydalanuvchisiga tushiradi. Oddiy holatda (USER node) — shunchaki ishga tushadi.
set -eu

if [ "$(id -u)" = "0" ]; then
  dir="${MEDIA_DIR:-}"
  if [ -z "$dir" ] && [ -n "${RAILWAY_VOLUME_MOUNT_PATH:-}" ]; then dir="$RAILWAY_VOLUME_MOUNT_PATH/media"; fi
  if [ -n "$dir" ]; then
    mkdir -p "$dir"
    chown node:node "$dir"
  fi
  exec setpriv --reuid=node --regid=node --init-groups -- "$0" "$@"
fi

npx prisma migrate deploy
exec node dist/main.js
