@echo off
REM ensure-pm2.bat — Garante que PM2 daemon está sempre rodando
REM Executado pela Tarefa Agendada do Windows a cada 5 minutos

setlocal enabledelayedexpansion

REM Verifica se PM2 daemon está respondendo
pm2 ping >nul 2>&1
if %ERRORLEVEL% neq 0 (
    REM PM2 não está respondendo, inicia ele
    echo [%date% %time%] PM2 não respondeu. Iniciando... >> "%USERPROFILE%\.pm2\ensure-pm2.log"

    REM Mata qualquer processo PM2 antigo
    taskkill /F /IM node.exe 2>nul

    REM Aguarda um pouco
    timeout /t 2 /nobreak >nul

    REM Inicia PM2 com resurrect
    cd /d "%USERPROFILE%"
    call pm2 resurrect >>"%USERPROFILE%\.pm2\ensure-pm2.log" 2>&1

    REM Se resurrect falhou, tenta pelo ecosystem
    pm2 ping >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        cd /d "C:\Users\erick\Projects\aios-core\aria"
        call pm2 start ecosystem.config.js >>"%USERPROFILE%\.pm2\ensure-pm2.log" 2>&1
    )

    echo [%date% %time%] PM2 reiniciado com sucesso >> "%USERPROFILE%\.pm2\ensure-pm2.log"
) else (
    REM PM2 está respondendo, tudo ok
    echo [%date% %time%] PM2 OK >> "%USERPROFILE%\.pm2\ensure-pm2.log"
)

REM Limpa log se ficar muito grande (mais de 1000 linhas)
for /f %%i in ('find /c /v "" ^< "%USERPROFILE%\.pm2\ensure-pm2.log"') do set /a lines=%%i
if %lines% gtr 1000 (
    type nul > "%USERPROFILE%\.pm2\ensure-pm2.log"
)
