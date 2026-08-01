$ErrorActionPreference = 'Stop'

$taskName = 'Hospital Punta Lara - WhatsApp Agent'
$agentScript = 'D:\Hopital-Punta-Lara\scripts\start-whatsapp-agent.cmd'

$action = New-ScheduledTaskAction `
  -Execute 'C:\Windows\System32\cmd.exe' `
  -Argument "/d /c `"$agentScript`""

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal `
  -UserId 'SYSTEM' `
  -LogonType ServiceAccount `
  -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null
