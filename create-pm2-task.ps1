# create-pm2-task.ps1 — Cria tarefa agendada para monitorar PM2

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c C:\Users\erick\Projects\aios-core\ensure-pm2.bat'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit '00:05:00'
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

Register-ScheduledTask -TaskName 'ARIA - Ensure PM2 Running' -Trigger $trigger -Action $action -Settings $settings -Principal $principal -Description 'Monitora e reinicia PM2 a cada 5 minutos' -Force

Write-Host "✅ Tarefa agendada 'ARIA - Ensure PM2 Running' criada com sucesso!" -ForegroundColor Green
Write-Host "   Executará a cada 5 minutos para garantir que PM2 está sempre rodando" -ForegroundColor Green
