@echo off
echo ================================================
echo   Business 3D - Starting All Services
echo ================================================
echo.
cd /d %~dp0

REM Find local IP
set LOCAL_IP=YOUR_IP
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    for /f "tokens=*" %%a in ("%%i") do set LOCAL_IP=%%a
)

echo Services starting in separate windows:
echo.
echo   CRM Server  ^-^>  http://localhost:3000
echo   ERP-AI API  ^-^>  http://localhost:8000
echo   AI API Docs ^-^>  http://localhost:8000/docs
echo.
echo   Network CRM ^-^>  http://%LOCAL_IP%:3000
echo   Network AI  ^-^>  http://%LOCAL_IP%:8000
echo.

REM Start ERP-AI (FastAPI + uvicorn) in a new window
start "ERP-AI (FastAPI :8000)" cmd /k "cd /d %~dp0erp-ai && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM Small delay so Python starts initializing first
timeout /t 2 /nobreak >nul

REM Start CRM Node.js server in a new window
start "CRM Server (Node.js :3000)" cmd /k "cd /d %~dp0 && npm run dev"

echo Both services are starting in their own windows.
echo Close those windows (or press Ctrl+C inside them) to stop.
echo.
pause
