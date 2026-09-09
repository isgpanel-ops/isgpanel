#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/var/www"
FRONTEND_DIR="$PROJECT_DIR"
BACKEND_DIR="$PROJECT_DIR/backend"
DEPLOY_KEY="$HOME/.ssh/isgpanel_github"

# PM2 kullaniyorsan bu isimleri kendi process isimlerinle eslestir.
BACKEND_PM2_NAME="server"

cd "$PROJECT_DIR"

if [ "${SKIP_GIT_PULL:-0}" = "1" ]; then
  echo "==> GitHub atlandi; yuklenen yerel paket derlenecek"
elif [ -d "$PROJECT_DIR/.git" ]; then
  if [ -f "$DEPLOY_KEY" ]; then
    export GIT_SSH_COMMAND="ssh -i $DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  fi
  echo "==> Kod guncelleniyor (main)"
  git checkout -- deploy/deploy_server.sh || true
  git fetch origin main
  git checkout main
  git pull --ff-only origin main
  echo "==> Canli commit: $(git rev-parse --short HEAD)"
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
# Sunucu internete kapalıysa Puppeteer'in Chromium indirmesi deploy'u durdurmamalı.
# Mevcut sistem Chromium/Chrome kurulumunu runtime'da kullanır.
PUPPETEER_SKIP_DOWNLOAD=1 npm ci

echo "==> PDF tarayıcısı kontrol ediliyor"
PDF_BROWSER=""
for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PDF_BROWSER="$(command -v "$candidate")"
    break
  fi
done

if [ -z "$PDF_BROWSER" ]; then
  echo "==> Chromium kuruluyor"
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "PDF için Chromium bulunamadı ve bu sunucuda apt-get yok."
    exit 1
  fi

  if ! getent hosts mirror.hetzner.com >/dev/null 2>&1; then
    echo "==> Sunucu DNS ayarı düzeltiliyor"
    DNS_INTERFACE="$(ip route | awk '/default/ {print $5; exit}')"
    if command -v resolvectl >/dev/null 2>&1 && [ -n "$DNS_INTERFACE" ]; then
      resolvectl dns "$DNS_INTERFACE" 1.1.1.1 8.8.8.8 || true
      resolvectl domain "$DNS_INTERFACE" "~." || true
    fi
    if ! getent hosts mirror.hetzner.com >/dev/null 2>&1; then
      mkdir -p /etc
      # Bazı Ubuntu sunucularında /etc/resolv.conf, çalışmayan systemd-resolved
      # hedefine bağlanmış olabiliyor. Bu durumda gerçek resolver dosyası oluşturulur.
      if [ -L /etc/resolv.conf ] && [ ! -e /etc/resolv.conf ]; then
        rm -f /etc/resolv.conf
      fi
      printf 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n' > /etc/resolv.conf

      # Bu sunucuda systemd-resolved servisi yok. NSS `resolve` kullanmayı
      # sürdürürse resolv.conf doğru olsa bile alan adları çözülemez.
      if [ -f /etc/nsswitch.conf ]; then
        sed -i -E '/^hosts:/c\hosts: files dns' /etc/nsswitch.conf
      fi
    fi
  fi

  if ! getent hosts mirror.hetzner.com >/dev/null 2>&1; then
    echo "Sunucu DNS'i çözülemedi; Chromium kurulumu güvenle başlatılamaz."
    exit 1
  fi

  apt-get update

  install_pdf_browser() {
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$1"
  }

  install_pdf_browser chromium || install_pdf_browser chromium-browser || true

  if ! command -v chromium >/dev/null 2>&1 && \
     ! command -v chromium-browser >/dev/null 2>&1 && \
     ! command -v google-chrome >/dev/null 2>&1 && \
     ! command -v google-chrome-stable >/dev/null 2>&1 && \
     command -v snap >/dev/null 2>&1; then
    snap install chromium || true
  fi

  if ! command -v chromium >/dev/null 2>&1 && \
     ! command -v chromium-browser >/dev/null 2>&1 && \
     ! command -v google-chrome >/dev/null 2>&1 && \
     ! command -v google-chrome-stable >/dev/null 2>&1; then
    echo "==> Google Chrome paketi kuruluyor"
    CHROME_DEB="/tmp/google-chrome-stable_current_amd64.deb"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL -o "$CHROME_DEB" \
        "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb" || true
    elif command -v wget >/dev/null 2>&1; then
      wget -q -O "$CHROME_DEB" \
        "https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb" || true
    fi

    if [ -s "$CHROME_DEB" ]; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y "$CHROME_DEB" || true
      rm -f "$CHROME_DEB"
    fi
  fi

  for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PDF_BROWSER="$(command -v "$candidate")"
      break
    fi
  done

  if [ -z "$PDF_BROWSER" ] && [ -x /snap/bin/chromium ]; then
    PDF_BROWSER="/snap/bin/chromium"
  fi
fi

if [ -z "$PDF_BROWSER" ]; then
  echo "Chromium kurulamadı; PDF üretimi başlatılamaz."
  exit 1
fi

echo "==> PDF tarayıcısı: $PDF_BROWSER"
export PUPPETEER_EXECUTABLE_PATH="$PDF_BROWSER"
if [ -f "$BACKEND_DIR/.env" ]; then
  if grep -q '^PUPPETEER_EXECUTABLE_PATH=' "$BACKEND_DIR/.env"; then
    sed -i "s|^PUPPETEER_EXECUTABLE_PATH=.*|PUPPETEER_EXECUTABLE_PATH=$PDF_BROWSER|" "$BACKEND_DIR/.env"
  else
    printf '\nPUPPETEER_EXECUTABLE_PATH=%s\n' "$PDF_BROWSER" >> "$BACKEND_DIR/.env"
  fi
fi

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
