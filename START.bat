@echo off
title Business360
color 0B
cls

echo.
echo  ================================================
echo    BUSINESS360  ^|  Dev Launcher
echo  ================================================
echo.

where node >nul 2>&1 || (
    echo  [ERROR] Node.js not found ^(https://nodejs.org^)
    pause & exit /b 1
)

echo  Clearing ports 3003 and 4000...
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3003 "') do taskkill /f /pid %%p >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":4000 "') do taskkill /f /pid %%p >nul 2>&1

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo.
echo  [1/3]  API    ^>  http://localhost:4000
start "API :4000" cmd /k "color 0A && cd /d "%ROOT%" && npm run dev:api"

timeout /t 2 /nobreak >nul

echo  [2/3]  Web    ^>  http://localhost:3003
start "Web :3003" cmd /k "color 0E && cd /d "%ROOT%" && npm run dev:web"

timeout /t 2 /nobreak >nul

set "CF=%ROOT%\cloudflare\cloudflared.exe"
if exist "%CF%" (
    echo  [3/3]  Tunnel ^>  starting...
    start "Tunnel" cmd /k "color 0D && "%CF%" tunnel --url http://localhost:3003"
) else (
    echo  [3/3]  Tunnel ^>  skipped ^(cloudflare\cloudflared.exe not found^)
)

echo.
echo  ================================================
echo    Web    http://localhost:3003
echo    API    http://localhost:4000
echo    Health http://localhost:4000/health
echo  ================================================
echo.
echo  Done. Close this window.
pause >nul
