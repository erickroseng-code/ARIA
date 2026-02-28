# register-pm2-task-admin.ps1 — Registra tarefa agendada com privilégios elevados
# Execute com: powershell -ExecutionPolicy Bypass -File register-pm2-task-admin.ps1

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c C:\Users\erick\Projects\aios-core\ensure-pm2.bat'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit '00:05:00'
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

try {
    Register-ScheduledTask -TaskName 'ARIA - Ensure PM2 Running' -Trigger $trigger -Action $action -Settings $settings -Principal $principal -Description 'Monitora e reinicia PM2 a cada 5 minutos' -Force -ErrorAction Stop
    Write-Host "✅ Tarefa agendada 'ARIA - Ensure PM2 Running' criada com sucesso!" -ForegroundColor Green
    Write-Host "   Executará a cada 5 minutos para garantir que PM2 está sempre rodando" -ForegroundColor Green
    Write-Host "   Verifique em: Agendador de Tarefas > ARIA - Ensure PM2 Running" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao criar tarefa: $_" -ForegroundColor Red
    Write-Host "   Tente executar PowerShell como Administrador" -ForegroundColor Yellow
    exit 1
}
