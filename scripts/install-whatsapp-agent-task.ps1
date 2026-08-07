$ErrorActionPreference = 'Stop'

$taskName = 'Hospital WhatsApp Agent'
$projectPath = 'D:\Hopital-Punta-Lara'
$agentScript = Join-Path $projectPath 'scripts\start-whatsapp-agent.ps1'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principalActual = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principalActual.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Este instalador debe ejecutarse como administrador.'
}

if (-not (Test-Path -LiteralPath $agentScript)) {
  throw "No se encontro el iniciador del agente: $agentScript"
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agentScript`"" `
  -WorkingDirectory $projectPath
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal `
  -UserId 'SYSTEM' `
  -LogonType ServiceAccount `
  -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $taskPrincipal `
  -Settings $settings `
  -Description 'Inicia y mantiene activo el agente de WhatsApp del Hospital Punta Lara al encender Windows.' `
  -Force | Out-Null

$registeredTask = Get-ScheduledTask -TaskName $taskName
if ($registeredTask.State -eq 'Running') {
  Stop-ScheduledTask -TaskName $taskName
  Start-Sleep -Seconds 2
}
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 10

$task = Get-ScheduledTask -TaskName $taskName
$info = Get-ScheduledTaskInfo -TaskName $taskName
$agentProcesses = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'dist[\\/]whatsapp-agent\.js' }
$supervisorProcesses = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match 'start-whatsapp-agent\.ps1' }
$verificationPath = Join-Path $projectPath 'backend\storage\whatsapp-agent-logs\task-installation.txt'
New-Item -ItemType Directory -Path (Split-Path $verificationPath) -Force | Out-Null
@(
  "Tarea instalada: $($task.TaskName)"
  "Estado: $($task.State)"
  "Ultimo resultado: $($info.LastTaskResult)"
  "Agentes activos: $(@($agentProcesses).Count)"
  "Supervisores activos: $(@($supervisorProcesses).Count)"
  "Verificada: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
) | Set-Content -LiteralPath $verificationPath -Encoding UTF8
Write-Host "Tarea instalada: $($task.TaskName)"
Write-Host "Estado: $($task.State)"
Write-Host "Ultimo resultado: $($info.LastTaskResult)"
