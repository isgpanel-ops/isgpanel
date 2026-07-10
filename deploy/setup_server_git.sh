#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www"
REPO_SSH="ssh://git@ssh.github.com:443/isgpanel-ops/isgpanel.git"
DEPLOY_KEY="$HOME/.ssh/isgpanel_github"
BACKUP_DIR="$HOME/isgpanel-backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/var-www-before-git-$STAMP.tgz"

if [ ! -f "$DEPLOY_KEY" ]; then
  echo "Deploy key bulunamadi: $DEPLOY_KEY"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "==> /var/www yedegi aliniyor"
tar \
  --exclude="$PROJECT_DIR/node_modules" \
  --exclude="$PROJECT_DIR/backend/node_modules" \
  --exclude="$PROJECT_DIR/dist" \
  -czf "$BACKUP_FILE" \
  "$PROJECT_DIR"

echo "==> Yedek hazir: $BACKUP_FILE"

cd "$PROJECT_DIR"

echo "==> Gecici .gitignore yaziliyor"
cat > .gitignore <<'EOF'
node_modules/
backend/node_modules/
dist/

.env
.env.*
backend/.env
backend/.env.*

backend/uploads/
uploads/
backend/isgpanel.db
*.db
*.sqlite
*.sqlite3

npm-debug.log*
yarn-debug.log*
yarn-error.log*

.DS_Store
Thumbs.db

html/
output/
react/
Risk/
-H
-d
EOF

if [ ! -d .git ]; then
  echo "==> Git baslatiliyor"
  git init
fi

git config user.name "ISGPanel Prod"
git config user.email "prod@isgpanel.local"

if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "==> Canli sunucu snapshot commit olusturuluyor"
  git add .
  git commit -m "Server pre-git snapshot" || true
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_SSH"
else
  git remote add origin "$REPO_SSH"
fi

export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo "==> GitHub'dan main branch cekiliyor"
git fetch origin main

echo "==> /var/www GitHub main ile eslestiriliyor"
git checkout -B main origin/main

echo "==> Dependency kurulumu"
npm ci

echo "==> Frontend build"
npm run build

echo "==> Backend dependency kurulumu"
cd "$PROJECT_DIR/backend"
npm ci

echo "==> PM2 restart"
pm2 restart server --update-env
pm2 save

echo "==> Git baglantisi tamamlandi"
echo "==> Yedek: $BACKUP_FILE"
