# start-aria.ps1
# ------------------------------------------------------------------------------
# Script de Inicialização da Assistente ARIA em Background (Windows Nativo)
# ------------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "    Iniciando a ARIA com Maxima Performance       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$CurrentDir = Get-Location
$ApiDir = Join-Path $CurrentDir "aria\apps\api"
$WebDir = Join-Path $CurrentDir "aria\apps\web"

# Verifica e Mata instâncias zumbis nas portas (3000 e 3001) para evitar conflitos
$ports = @(3000, 3001)
foreach ($port in $ports) {
    try {
        $pidOnPort = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess
        if ($null -ne $pidOnPort) {
            Write-Host "Limpando processo antigo na porta $port..." -ForegroundColor Yellow
            Stop-Process -Id $pidOnPort -Force -ErrorAction SilentlyContinue
        }
    }
    catch { }
}

Write-Host "Iniciando Backend (API)..." -ForegroundColor White
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c npx tsx src/server.ts" -WorkingDirectory $ApiDir

Write-Host "Iniciando Frontend (Web)..." -ForegroundColor White
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c npm run start" -WorkingDirectory $WebDir

Write-Host "Aguardando inicialização (5s)..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "✅ ARIA iniciada em segundo plano!" -ForegroundColor Green
Write-Host "-> Frontend (Chat): http://localhost:3000" -ForegroundColor Green
Write-Host "-> Backend (API) : http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "DICA: Voce PODE fechar este terminal." -ForegroundColor DarkGray
Write-Host "Para desligar a ARIA, feche os processos 'node.exe' no Gerenciador de Tarefas." -ForegroundColor DarkGray
Write-Host "==================================================" -ForegroundColor Cyan
