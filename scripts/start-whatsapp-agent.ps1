$ErrorActionPreference = 'Continue'

$projectPath = 'D:\Hopital-Punta-Lara'
$npmPath = 'C:\Program Files\nodejs\npm.cmd'
$logDirectory = 'D:\Hospital-WhatsApp\logs'
$logPath = Join-Path $logDirectory 'whatsapp-agent.log'

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $projectPath

while ($true) {
  Add-Content -LiteralPath $logPath -Value "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Iniciando agente de WhatsApp"

  & $npmPath run whatsapp:agent *>> $logPath
  $exitCode = $LASTEXITCODE

  Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] El agente termino con codigo $exitCode. Reintentando en 15 segundos."
  Start-Sleep -Seconds 15
}
