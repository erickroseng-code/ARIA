# aria-monitor.ps1 — Monitora ARIA continuamente
# Executa em background indefinidamente, mesmo com terminal fechado

$logFile = "$PSScriptRoot\.aria\monitor-$(Get-Date -Format 'yyyy-MM-dd').log"
$logDir = Split-Path $logFile
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

function Log($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp | $msg" | Add-Content $logFile
    Write-Host "$timestamp | $msg"
}

Log "🚀 Monitor ARIA iniciado"

while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    try {
        $apiResponse = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 3 -ErrorAction Stop
        if ($apiResponse.StatusCode -eq 200) {
            $json = $apiResponse.Content | ConvertFrom-Json
            Log "✅ API OK - uptime: $($json.uptime)s - memory: $($json.memory.heapUsed)MB"
        }
    } catch {
        Log "❌ API ERROR - $_"
    }

    Start-Sleep -Seconds 10
}
