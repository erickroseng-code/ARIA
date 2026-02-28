# start-dev.ps1
# ARIA startup via PM2 — auto-restart, sem bloquear terminal
# Usage: .\start-dev.ps1

Write-Host "`n🔧 ARIA Dev Startup via PM2..." -ForegroundColor Cyan

# Tentar restaurar estado salvo (API + Web + Bot)
$resurrected = $false
try {
    $result = & pm2 resurrect 2>&1
    if ($LASTEXITCODE -eq 0 -and $result -notmatch "error") {
        $resurrected = $true
        Write-Host "  ✓ PM2: estado restaurado (resurrect)" -ForegroundColor Green
    }
} catch {}

# Se resurrect falhou, iniciar pelo ecosystem
if (-not $resurrected) {
    Write-Host "  → PM2 resurrect falhou, iniciando pelo ecosystem..." -ForegroundColor Yellow
    Set-Location "$PSScriptRoot\aria"
    & pm2 start ecosystem.config.js 2>&1
    & pm2 save 2>&1
}

Write-Host "`n✅ Serviços ARIA em execução via PM2:" -ForegroundColor Green
Write-Host "   API:  http://localhost:3001/health" -ForegroundColor White
Write-Host "   Web:  http://localhost:3000" -ForegroundColor White
Write-Host "   Bot:  assistente-bot" -ForegroundColor White
Write-Host "`n[ PM2 ] Use 'pm2 list' para ver status, 'pm2 logs' para logs" -ForegroundColor Gray
Write-Host "-------------------------------------------------------------`n" -ForegroundColor DarkGray

& pm2 list
