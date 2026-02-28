@echo off
REM aria-monitor.bat — Monitora ARIA continuamente em background
REM Deixe rodando em background para verificar status continuamente

setlocal enabledelayedexpansion
set "logFile=%~dp0.aria\monitor.log"
set "logDir=%~dp0.aria"

if not exist "%logDir%" mkdir "%logDir%"

:loop
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do set "dateStamp=%%c-%%a-%%b"
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do set "timeStamp=%%a:%%b"

echo [%dateStamp% %timeStamp%] Verificando ARIA... >> "%logFile%"

curl -s http://localhost:3001/health >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [%dateStamp% %timeStamp%] OK - API respondendo >> "%logFile%"
) else (
    echo [%dateStamp% %timeStamp%] ERRO - API nao responde >> "%logFile%"
)

timeout /t 10 /nobreak >nul
goto loop
