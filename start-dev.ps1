# start-dev.ps1
# Safe ARIA dev startup script
# Kills any zombie node processes on ports 3001 and 3000 before starting fresh servers via Turborepo
# Usage: .\start-dev.ps1

Write-Host "`n🔧 ARIA Dev Startup — Cleaning up old processes..." -ForegroundColor Cyan

# Kill anything on port 3001
Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host "  ✓ Killed process on port 3001" -ForegroundColor Yellow }

# Kill anything on port 3000
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host "  ✓ Killed process on port 3000" -ForegroundColor Yellow }

Start-Sleep 2

Write-Host "`n🚀 Starting ARIA unified servers via Turborepo..." -ForegroundColor Cyan
Write-Host "   API:  http://localhost:3001/health" -ForegroundColor White
Write-Host "   Web:  http://localhost:3000" -ForegroundColor White
Write-Host "`n[ Tip ] Press Ctrl+C to gracefully stop everything." -ForegroundColor Gray
Write-Host "-------------------------------------------------------------`n" -ForegroundColor DarkGray

Set-Location "$PSScriptRoot\aria"
npm run dev
