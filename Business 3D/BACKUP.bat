@echo off
REM ============================================
REM CRM Project - Backup & Distribution
REM ============================================
REM Creates a packaged version ready for distribution

echo.
echo ============================================
echo   CRM Project Backup & Distribution
echo ============================================
echo.

REM Get date and time for backup name
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set backup_name=crm-backup-%mydate%-%mytime%

echo Creating backup: %backup_name%
echo.

REM Create backup directory
if not exist backups mkdir backups

REM Copy files
echo Copying project files...
robocopy . "backups\%backup_name%" ^
    /S /E ^
    /EXCLUDE:node_modules backups crm.db crm.db-shm crm.db-wal .git .gitignore

REM Create archive
echo Creating ZIP file...
cd backups
if exist ..\7z.exe (
    ..\7z.exe a -r "%backup_name%.7z" "%backup_name%"
) else (
    REM Fallback: Try to use Windows native ZIP (if available)
    powershell -Command "Compress-Archive -Path '%backup_name%' -DestinationPath '%backup_name%.zip'"
)
cd..

echo.
echo ============================================
echo   Backup Complete!
echo ============================================
echo.
echo Backup location: backups\%backup_name%
echo.
echo Files included:
echo - Server code (server.js)
echo - Frontend (public/)
echo - Configuration (.env.example)
echo - Documentation
echo.
echo Files excluded:
echo - node_modules (reinstall with setup.bat)
echo - Database (crm.db - kept separate)
echo - Previous backups
echo.
echo To restore:
echo 1. Extract backup to new folder
echo 2. Run setup.bat
echo 3. Copy old database if needed
echo.
pause
