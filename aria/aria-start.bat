@echo off
REM ARIA - Manual startup script
REM Use this if PM2 didn't auto-start after reboot

set PM2_HOME=C:\Users\erick\.pm2

echo [ARIA] Checking PM2 status...
pm2 status

echo.
echo [ARIA] Attempting to resurrect saved processes...
pm2 resurrect

echo.
echo [ARIA] If resurrect shows no processes, starting from ecosystem config...
pm2 status 2>&1 | findstr /C:"online" >nul
if errorlevel 1 (
    echo [ARIA] No processes online, starting from ecosystem.config.js...
    cd /d C:\Users\erick\Projects\aios-core\aria
    pm2 start ecosystem.config.js
    pm2 save
)

echo.
echo [ARIA] Final status:
pm2 status
