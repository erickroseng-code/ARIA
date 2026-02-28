# test-pm2-monitoring.ps1 — Testa o sistema de monitoramento PM2

Write-Host "=== TESTE DO SISTEMA DE MONITORAMENTO PM2 ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verifica status inicial
Write-Host "1️⃣ Status inicial:" -ForegroundColor Yellow
pm2 ping
$initialStatus = $?

# 2. Mostra processos PM2 atuais
Write-Host ""
Write-Host "2️⃣ Processos PM2 em execucao:" -ForegroundColor Yellow
pm2 list

# 3. Mata o daemon para simular falha
Write-Host ""
Write-Host "3️⃣ Simulando falha (matando daemon)..." -ForegroundColor Red
pm2 kill
Start-Sleep -Seconds 2

# 4. Confirma que PM2 está fora
Write-Host "4️⃣ Verificando se PM2 está fora:" -ForegroundColor Yellow
pm2 ping 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✅ PM2 está FORA (como esperado)" -ForegroundColor Green
} else {
    Write-Host "   ❌ PM2 ainda está respondendo (inesperado)" -ForegroundColor Red
}

# 5. Executa o script de recuperação
Write-Host ""
Write-Host "5️⃣ Executando ensure-pm2.bat para recuperar..." -ForegroundColor Cyan
cmd.exe /c "C:\Users\erick\Projects\aios-core\ensure-pm2.bat"
Start-Sleep -Seconds 2

# 6. Verifica se PM2 foi recuperado
Write-Host ""
Write-Host "6️⃣ Verificando se PM2 foi recuperado:" -ForegroundColor Yellow
$maxRetries = 5
$retryCount = 0
$recovered = $false

while ($retryCount -lt $maxRetries -and -not $recovered) {
    pm2 ping 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PM2 RECUPERADO COM SUCESSO!" -ForegroundColor Green
        $recovered = $true
    } else {
        $retryCount++
        Write-Host "   ⏳ Tentativa $retryCount/$maxRetries (aguardando $retryCount segundo(s))..."
        Start-Sleep -Seconds $retryCount
    }
}

if (-not $recovered) {
    Write-Host "   ❌ Falha em recuperar PM2 após $maxRetries tentativas" -ForegroundColor Red
    exit 1
}

# 7. Mostra processos após recuperacao
Write-Host ""
Write-Host "7️⃣ Processos PM2 apos recuperacao:" -ForegroundColor Yellow
pm2 list

Write-Host ""
Write-Host "✅ TESTE CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "   O sistema de monitoramento funciona corretamente!" -ForegroundColor Green
Write-Host ""
