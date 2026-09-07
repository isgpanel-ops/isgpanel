param(
  [string]$ConfigPath = "$PSScriptRoot\deploy_config.ps1"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Write-Host "Config bulunamadi: $ConfigPath" -ForegroundColor Red
  exit 1
}

. $ConfigPath

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$BundlePath = Join-Path $env:TEMP "isgpanel-deploy-bundle.tgz"
$RemoteBundlePath = "/tmp/isgpanel-deploy-bundle.tgz"
$OAuthEnvPath = Join-Path $env:TEMP "isgpanel-google-oauth.env"
$RemoteOAuthEnvPath = "/tmp/isgpanel-google-oauth.env"
$target = "$DeployUser@$DeployHost"

Write-Host "Deploy paketi hazirlaniyor..." -ForegroundColor Cyan
Push-Location $ProjectRoot

if (Test-Path -LiteralPath $BundlePath) {
  Remove-Item -LiteralPath $BundlePath -Force
}

tar `
  --exclude="node_modules" `
  --exclude="backend/node_modules" `
  --exclude="dist" `
  --exclude="backend/uploads" `
  --exclude="backend/isgpanel.db" `
  --exclude=".git" `
  --exclude=".env" `
  --exclude="backend/.env" `
  -czf $BundlePath `
  package.json package-lock.json index.html vite.config.js tailwind.config.js postcss.config.js jsconfig.json components.json src public backend deploy isg_prosedur_template

Pop-Location

$OAuthKeys = @("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "MAIL_OAUTH_CALLBACK_BASE")
$LocalBackendEnv = Join-Path $ProjectRoot "backend\.env"
$OAuthLines = @()
if (Test-Path -LiteralPath $LocalBackendEnv) {
  $OAuthLines = Get-Content -LiteralPath $LocalBackendEnv | Where-Object {
    $_ -match "^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|MAIL_OAUTH_CALLBACK_BASE)="
  }
}

if ($OAuthLines.Count -eq $OAuthKeys.Count) {
  Set-Content -LiteralPath $OAuthEnvPath -Value $OAuthLines -Encoding ascii
} else {
  Remove-Item -LiteralPath $OAuthEnvPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Paket sunucuya gonderiliyor..." -ForegroundColor Cyan
scp $BundlePath "${target}:$RemoteBundlePath"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Paket gonderilemedi." -ForegroundColor Red
  exit $LASTEXITCODE
}

if (Test-Path -LiteralPath $OAuthEnvPath) {
  Write-Host "Google OAuth ayarlari sunucuya aktariliyor..." -ForegroundColor Cyan
  scp $OAuthEnvPath "${target}:$RemoteOAuthEnvPath"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Google OAuth ayarlari gonderilemedi." -ForegroundColor Red
    exit $LASTEXITCODE
  }

  ssh $target "set -e; cd '$RemoteProjectPath'; touch backend/.env; tmp=`$(mktemp); grep -v -E '^(GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET|MAIL_OAUTH_CALLBACK_BASE)=' backend/.env > `$tmp || true; cat '$RemoteOAuthEnvPath' >> `$tmp; mv `$tmp backend/.env; chmod 600 backend/.env; rm -f '$RemoteOAuthEnvPath'"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Google OAuth ayarlari sunucuya yazilamadi." -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "Sunucuda paket aciliyor..." -ForegroundColor Cyan
ssh $target "cd '$RemoteProjectPath' && tar -xzf '$RemoteBundlePath' && SKIP_GIT_PULL=1 bash '$RemoteDeployScript'"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy basarisiz oldu." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Deploy tamamlandi." -ForegroundColor Green
Remove-Item -LiteralPath $OAuthEnvPath -Force -ErrorAction SilentlyContinue
