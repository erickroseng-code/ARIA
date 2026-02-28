# install-pm2-monitoring.ps1 — Auto-eleva e cria tarefa agendada de monitoramento PM2

# Verifica se está rodando como admin
$adminCheck = [Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
if (-NOT $adminCheck.IsInRole([Security.Principal.WindowsBuiltInRole] 'Administrator')) {
    Write-Host "Solicitando privilegios elevados (UAC)..." -ForegroundColor Yellow
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\install-pm2-monitoring.ps1`"" -Verb RunAs
    exit
}

Write-Host "Executando com privilegios de administrador" -ForegroundColor Green
Write-Host ""

# Cria a tarefa agendada
$scriptPath = "C:\Users\erick\Projects\aios-core\ensure-pm2.bat"
$taskName = "ARIA - Ensure PM2 Running"

Write-Host "Criando tarefa agendada: $taskName" -ForegroundColor Cyan

$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 365)

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c $scriptPath"

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit '00:05:00'

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest

try {
    Register-ScheduledTask -TaskName $taskName -Trigger $trigger -Action $action -Settings $settings -Principal $principal -Description "Monitora e reinicia PM2 a cada 5 minutos para manter ARIA sempre rodando" -Force -ErrorAction Stop

    Write-Host ""
    Write-Host "SUCESSO! Tarefa agendada criada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Detalhes:" -ForegroundColor Cyan
    Write-Host "   Nome: $taskName"
    Write-Host "   Intervalo: A cada 5 minutos"
    Write-Host "   Duracao: 365 dias"
    Write-Host "   Script: $scriptPath"
    Write-Host ""
    Write-Host "Para verificar:" -ForegroundColor Cyan
    Write-Host "   1. Abra Task Scheduler (Agendador de Tarefas)"
    Write-Host "   2. Procure por: $taskName"
    Write-Host ""
    Write-Host "Agora voce pode:" -ForegroundColor Green
    Write-Host "   1. Fechar este terminal"
    Write-Host "   2. ARIA continuara rodando em background"
    Write-Host "   3. Se PM2 cair, sera reiniciado automaticamente"
    Write-Host ""

} catch {
    Write-Host ""
    Write-Host "ERRO ao criar tarefa!" -ForegroundColor Red
    Write-Host "Detalhes: $_" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Read-Host "Pressione Enter para fechar"
