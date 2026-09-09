param(
  [string]$ConfigPath = "$PSScriptRoot\deploy_config.ps1"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Write-Host "Config bulunamadi: $ConfigPath" -ForegroundColor Red
  exit 1
}

. $ConfigPath

$target = "$DeployUser@$DeployHost"

Write-Host "Sunucu PDF/DNS tanisi baslatiliyor..." -ForegroundColor Cyan
ssh $target @'
set +e
echo "=== KIMLIK VE KOK DOSYA SISTEMI ==="
id
pwd
ls -ld / /etc /etc/resolv.conf
readlink -f /etc/resolv.conf
echo
echo "=== DNS ==="
getent hosts mirror.hetzner.com
getent hosts storage.googleapis.com
cat /etc/resolv.conf
echo
echo "=== PDF TARAYICISI ==="
command -v chromium
command -v chromium-browser
command -v google-chrome
command -v google-chrome-stable
ls -l /snap/bin/chromium
echo
echo "=== ISLETIM SISTEMI ==="
cat /etc/os-release
'@

if ($LASTEXITCODE -ne 0) {
  Write-Host "Tani komutu basarisiz oldu." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Tani tamamlandi." -ForegroundColor Green
