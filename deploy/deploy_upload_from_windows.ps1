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
  package.json package-lock.json index.html vite.config.js tailwind.config.js postcss.config.js jsconfig.json components.json src public backend isg_prosedur_template

Pop-Location

Write-Host "Paket sunucuya gonderiliyor..." -ForegroundColor Cyan
scp $BundlePath "${target}:$RemoteBundlePath"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Paket gonderilemedi." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Sunucuda paket aciliyor..." -ForegroundColor Cyan
ssh $target "cd '$RemoteProjectPath' && tar -xzf '$RemoteBundlePath' && bash '$RemoteDeployScript'"
if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy basarisiz oldu." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Deploy tamamlandi." -ForegroundColor Green
