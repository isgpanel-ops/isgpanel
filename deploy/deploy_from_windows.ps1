param(
  [string]$ConfigPath = "$PSScriptRoot\deploy_config.ps1"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Write-Host "Config bulunamadi: $ConfigPath" -ForegroundColor Red
  Write-Host "Once deploy_config.example.ps1 dosyasini deploy_config.ps1 olarak kopyalayip doldurun."
  exit 1
}

. $ConfigPath

if (-not $DeployHost -or -not $DeployUser -or -not $RemoteDeployScript) {
  Write-Host "Deploy config eksik. DeployHost, DeployUser ve RemoteDeployScript alanlarini doldurun." -ForegroundColor Red
  exit 1
}

$target = "$DeployUser@$DeployHost"

Write-Host "Deploy basliyor: $target" -ForegroundColor Cyan
ssh $target "bash '$RemoteDeployScript'"

if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy basarisiz oldu." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Deploy tamamlandi." -ForegroundColor Green
