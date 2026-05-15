@echo off
REM ============================================
REM CRM Project Setup Script (Windows)
REM ============================================
REM This script initializes the CRM project with all dependencies
REM Run this before starting the application for the first time

echo.
echo ============================================
echo   CRM Project Setup
echo ============================================
echo.

REM Check if Node.js is installed
echo [1/4] Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo Found: %NODE_VERSION%
echo.

REM Check if npm is installed
echo [2/4] Checking npm installation...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is not installed!
    echo Please install npm as part of Node.js
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo Found: npm %NPM_VERSION%
echo.

REM Install project dependencies
echo [3/4] Installing project dependencies...
echo This may take a few minutes...
echo.
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Dependencies installed successfully!
echo.

REM Create environment file if it doesn't exist
echo [4/4] Configuring environment...
if not exist .env (
    echo Creating .env configuration file...
    copy .env.example .env >nul 2>&1
    if exist .env (
        echo .env file created successfully!
        echo.
        echo You can edit .env to customize:
        echo - PORT: Server port (default: 3000^)
        echo - HOST: Server host (default: 0.0.0.0 for network access^)
        echo - SMTP_HOST: Email settings (optional^)
    )
) else (
    echo .env file already exists, skipping...
)
echo.

REM Setup complete
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo Next steps:
echo 1. Edit .env file if needed (optional^)
echo 2. Run START.bat to start the server
echo 3. Open http://localhost:3000 in your browser
echo 4. Login with PIN: 1996
echo.
echo For more information, see SETUP.md
echo.
pause
