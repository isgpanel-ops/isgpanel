#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www"
FRONTEND_DIR="$PROJECT_DIR"
BACKEND_DIR="$PROJECT_DIR/backend"
DEPLOY_KEY="$HOME/.ssh/isgpanel_github"

# PM2 kullaniyorsan bu isimleri kendi process isimlerinle eslestir.
BACKEND_PM2_NAME="server"

cd "$PROJECT_DIR"

if [ -d "$PROJECT_DIR/.git" ]; then
  if [ -f "$DEPLOY_KEY" ]; then
    export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  fi
  echo "==> Kod guncelleniyor"
  git pull --ff-only
else
  echo "==> Git reposu yok, mevcut dosyalar uzerinden build alinacak"
fi

echo "==> Frontend dependency kontrolu"
cd "$FRONTEND_DIR"
npm ci

echo "==> Frontend build"
npm run build

echo "==> Backend dependency kontrolu"
cd "$BACKEND_DIR"
npm ci

if [ -f "$BACKEND_DIR/scripts/run-migrations.js" ]; then
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "==> Migration"
    npm run migrate
  else
    echo "==> Migration atlandi: DATABASE_URL tanimli degil"
  fi
fi

echo "==> Backend restart"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "$BACKEND_PM2_NAME" --update-env
  pm2 save
else
  echo "PM2 bulunamadi. Backend restart komutunu sunucuna gore duzenle."
  exit 1
fi

echo "==> Deploy tamamlandi"
