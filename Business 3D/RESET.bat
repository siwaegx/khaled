@echo off
REM ============================================
REM CRM Project - Reset Database
REM ============================================
REM WARNING: This will DELETE ALL DATA
REM Use this to start fresh or troubleshoot

echo.
echo ============================================
echo   CRM Database Reset
echo ============================================
echo.
echo WARNING: This will DELETE ALL project data!
echo.
set /p confirm="Are you sure? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo Reset cancelled.
    exit /b 0
)

echo.
echo Stopping server...
taskkill /f /im node.exe >nul 2>&1

echo Removing database files...
if exist crm.db del crm.db
if exist crm.db-shm del crm.db-shm
if exist crm.db-wal del crm.db-wal

echo Removing node_modules...
if exist node_modules rmdir /s /q node_modules

echo Removing package-lock.json...
if exist package-lock.json del package-lock.json

echo.
echo Reinstalling dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to reinstall dependencies
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Reset Complete!
echo ============================================
echo.
echo Database has been cleared.
echo Run START.bat to restart the server.
echo.
pause
