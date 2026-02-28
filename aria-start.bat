@echo off
REM ARIA Quick Start - Inicia PM2 desvinculado do terminal
REM Use este arquivo para iniciar/reiniciar a ARIA manualmente
REM Duplo clique ou execute: .\aria-start.bat

echo.
echo [ARIA] Iniciando servicos via PM2...

REM Verifica se PM2 daemon esta rodando
pm2 ping >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ARIA] Daemon PM2 nao encontrado. Iniciando...
    start /b wscript.exe "%APPDATA%\npm\node_modules\pm2-windows-startup\invisible.vbs" "%APPDATA%\npm\node_modules\pm2-windows-startup\pm2_resurrect.cmd"
    timeout /t 5 /nobreak >nul
) else (
    echo [ARIA] Daemon PM2 ja esta ativo. Restaurando processos...
    pm2 resurrect >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        cd /d "%~dp0aria"
        pm2 start ecosystem.config.js >nul 2>&1
    )
)

timeout /t 3 /nobreak >nul
pm2 list
echo.
echo [ARIA] Acesse: http://localhost:3000
echo.
