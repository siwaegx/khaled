@echo off
title Business360 Launcher
chcp 65001 >nul 2>&1
cls

REM ==============================================
:MENU
cls
echo.
echo  ==========================================
echo    BUSINESS360 LAUNCHER
echo  ==========================================
echo    1  ^>  Start Development
echo    2  ^>  Restart Servers
echo    3  ^>  Kill All Servers
echo    4  ^>  Run Tests
echo    5  ^>  Deploy to Cloudflare
echo    6  ^>  Exit
echo  ==========================================
echo.
choice /c 123456 /n /m "  Select: "
if errorlevel 6 goto EXIT
if errorlevel 5 goto DEPLOY_MENU
if errorlevel 4 goto TESTS
if errorlevel 3 goto KILL
if errorlevel 2 goto RESTART
if errorlevel 1 goto PREFLIGHT

REM ==============================================
:PREFLIGHT
cls
echo.
echo  ==========================================
echo    PRE-FLIGHT CHECK
echo  ==========================================
echo.
set ERR=0

REM -- Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Node.js not found
    echo         Install from https://nodejs.org
    set /a ERR+=1
) else (
    for /f %%v in ('node -v 2^>nul') do echo  [ OK ] Node.js %%v
)

REM -- npm
where npm >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] npm not found
    set /a ERR+=1
) else (
    for /f %%v in ('npm -v 2^>nul') do echo  [ OK ] npm v%%v
)

REM -- apps/api/.env
if not exist "apps\api\.env" (
    echo  [FAIL] apps\api\.env not found
    echo         Run: copy apps\api\.env.example apps\api\.env
    echo         Then fill in DATABASE_URL and JWT_SECRET
    set /a ERR+=1
) else (
    echo  [ OK ] apps\api\.env found
)

REM -- DATABASE_URL
if exist "apps\api\.env" (
    findstr /b "DATABASE_URL=" apps\api\.env >nul 2>&1
    if errorlevel 1 (
        echo  [FAIL] DATABASE_URL missing in apps\api\.env
        set /a ERR+=1
    ) else (
        echo  [ OK ] DATABASE_URL is set
    )
)

REM -- JWT_SECRET placeholder warning
if exist "apps\api\.env" (
    findstr "change-this-in-production" apps\api\.env >nul 2>&1
    if not errorlevel 1 (
        echo  [WARN] JWT_SECRET is still the default - change before production
    ) else (
        echo  [ OK ] JWT_SECRET is customized
    )
)

REM -- node_modules
if not exist "node_modules" (
    echo  [INFO] node_modules missing - installing...
    call npm install
    if errorlevel 1 (
        echo  [FAIL] npm install failed
        set /a ERR+=1
    ) else (
        echo  [ OK ] Dependencies installed
    )
) else (
    echo  [ OK ] node_modules present
)

REM -- Prisma schemas
if not exist "packages\db\prisma\schema.prisma" (
    echo  [FAIL] packages\db\prisma\schema.prisma not found
    set /a ERR+=1
) else (
    echo  [ OK ] Core schema found
)

if not exist "apps\api\prisma\tenant.prisma" (
    echo  [FAIL] apps\api\prisma\tenant.prisma not found
    set /a ERR+=1
) else (
    echo  [ OK ] Tenant schema found
)

REM -- PostgreSQL
netstat -an 2>nul | find ":5432 " >nul 2>&1
if errorlevel 1 (
    echo  [WARN] PostgreSQL not detected on :5432
) else (
    echo  [ OK ] PostgreSQL on :5432
)

REM -- Ports
netstat -an 2>nul | find ":4000 " >nul 2>&1
if not errorlevel 1 (echo  [WARN] Port 4000 in use) else (echo  [ OK ] Port 4000 free)

netstat -an 2>nul | find ":3003 " >nul 2>&1
if not errorlevel 1 (echo  [WARN] Port 3003 in use) else (echo  [ OK ] Port 3003 free)

netstat -an 2>nul | find ":3001 " >nul 2>&1
if not errorlevel 1 (echo  [WARN] Port 3001 in use) else (echo  [ OK ] Port 3001 free)

echo.

if %ERR% gtr 0 (
    echo  %ERR% errors found - fix and retry.
    echo.
    pause
    goto MENU
)

echo  All checks passed.
echo.
echo  Generating Prisma clients...

call npx prisma generate --schema=packages/db/prisma/schema.prisma >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Core prisma generate failed
    pause
    goto MENU
)

call npx prisma generate --schema=apps/api/prisma/tenant.prisma >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Tenant prisma generate failed
    pause
    goto MENU
)

echo  Prisma ready.
echo.
goto START_SERVERS

REM ==============================================
:KILL
cls
echo.
echo  ==========================================
echo    KILL ALL SERVERS
echo  ==========================================
echo.
echo  Stopping servers...

powershell -NoProfile -Command "$ports = @(4000,3003,3001); $ports | ForEach-Object { $port = $_; (netstat -ano 2>$null | Select-String """":$port """") -replace '.*\s(\d+)$','$1' | Select-Object -Unique | Where-Object { $_ -match '^\d+$' -and $_ -ne '0' } | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host """  Killed PID $_ (port $port)""" } }"

echo.
echo  Done. Ports 4000 / 3003 / 3001 are free.
echo.
pause
goto MENU

REM ==============================================
:RESTART
cls
echo.
echo  ==========================================
echo    RESTART SERVERS
echo  ==========================================
echo.
echo  Stopping servers...

taskkill /FI "WINDOWTITLE eq Business360 API" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Business360 Web" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ERPAI Developer Agent" /F >nul 2>&1

for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| find ":4000 "') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| find ":3003 "') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| find ":3001 "') do taskkill /PID %%p /F >nul 2>&1

echo  Waiting for ports to release...
timeout /t 3 /nobreak >nul

echo  Regenerating Prisma clients...
call npx prisma generate --schema=packages/db/prisma/schema.prisma >nul 2>&1
call npx prisma generate --schema=apps/api/prisma/tenant.prisma >nul 2>&1
echo  Done.
echo.
goto START_SERVERS

REM ==============================================
:START_SERVERS
echo  Launching servers...
echo.
start "Business360 API"       /d "%~dp0" cmd /k "npm run dev --workspace=apps/api"
start "Business360 Web"       /d "%~dp0" cmd /k "npm run dev --workspace=apps/web"
start "ERPAI Developer Agent" /d "%~dp0" cmd /k "npm run dev --workspace=erpai"

echo  ==========================================
echo    SERVERS STARTED
echo  ==========================================
echo    API    ->  http://localhost:4000
echo    Web    ->  http://localhost:3003
echo    ERPAI  ->  http://localhost:3001
echo  ==========================================
echo.
echo  Allow ~10s for servers to be ready.
echo  Press any key to return to menu...
pause >nul
goto MENU

REM ==============================================
:TESTS
cls
echo.
echo  ==========================================
echo    RUN TESTS
echo  ==========================================
echo    1  ^>  API tests  (326+ vitest)
echo    2  ^>  Web tests  (vitest)
echo    3  ^>  Both
echo    4  ^>  Back
echo  ==========================================
echo.
choice /c 1234 /n /m "  Select: "
if errorlevel 4 goto MENU
if errorlevel 3 goto TEST_BOTH
if errorlevel 2 goto TEST_WEB
if errorlevel 1 goto TEST_API

:TEST_API
cls
echo.
echo  Running API tests...
echo.
call npm run test --workspace=apps/api
set T_RES=%errorlevel%
echo.
if %T_RES% equ 0 (echo  [ OK ] All tests passed) else (echo  [FAIL] Some tests failed)
echo.
pause
goto TESTS

:TEST_WEB
cls
echo.
echo  Running Web tests...
echo.
call npm run test --workspace=apps/web
set T_RES=%errorlevel%
echo.
if %T_RES% equ 0 (echo  [ OK ] All tests passed) else (echo  [FAIL] Some tests failed)
echo.
pause
goto TESTS

:TEST_BOTH
cls
echo.
echo  Running API tests...
echo.
call npm run test --workspace=apps/api
set API_RES=%errorlevel%
echo.
echo  Running Web tests...
echo.
call npm run test --workspace=apps/web
set WEB_RES=%errorlevel%
echo.
echo  ==========================================
if %API_RES% equ 0 (echo    API  ->  PASSED) else (echo    API  ->  FAILED)
if %WEB_RES% equ 0 (echo    Web  ->  PASSED) else (echo    Web  ->  FAILED)
echo  ==========================================
echo.
pause
goto TESTS

REM ==============================================
:DEPLOY_MENU
cls
echo.
echo  ==========================================
echo    CLOUDFLARE DEPLOY
echo  ==========================================
echo    1  ^>  Frontend only  (Pages)
echo    2  ^>  API only       (Docker + Tunnel)
echo    3  ^>  Both
echo    4  ^>  Back
echo  ==========================================
echo.
choice /c 1234 /n /m "  Select: "
if errorlevel 4 goto MENU
if errorlevel 3 goto DEPLOY_BOTH
if errorlevel 2 goto DEPLOY_API
if errorlevel 1 goto DEPLOY_WEB

:DEPLOY_WEB
set BOTH=0
goto BUILD_WEB

:DEPLOY_BOTH
set BOTH=1
goto BUILD_WEB

:BUILD_WEB
cls
echo.
echo  [Frontend] Building for Cloudflare Pages...
echo.
echo  [1/3] Installing dependencies...
call npm install --workspace=apps/web --silent
if errorlevel 1 (
    echo  ERROR: npm install failed
    pause
    goto DEPLOY_MENU
)

echo  [2/3] Building...
cd apps\web
call npx next build
if errorlevel 1 (
    echo  ERROR: next build failed
    cd ..\..
    pause
    goto DEPLOY_MENU
)
call npx @cloudflare/next-on-pages
if errorlevel 1 (
    echo  ERROR: next-on-pages failed
    cd ..\..
    pause
    goto DEPLOY_MENU
)

echo  [3/3] Deploying...
call npx wrangler pages deploy .vercel\output\static --project-name=business360-web --branch=production
set WEB_EXIT=%errorlevel%
cd ..\..

if %WEB_EXIT% neq 0 (
    echo.
    echo  ERROR: Deploy failed. Authenticate first:
    echo    cd apps\web ^&^& npx wrangler login
    pause
    goto DEPLOY_MENU
)

echo.
echo  ==========================================
echo    FRONTEND DEPLOYED
echo    https://business360-web.pages.dev
echo  ==========================================
echo.
if %BOTH%==1 goto BUILD_API
pause
goto MENU

:DEPLOY_API
set BOTH=0

:BUILD_API
cls
echo.
echo  [API] Deploying via Docker + Cloudflare Tunnel...
echo.

docker info >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Docker not running - start Docker Desktop first
    pause
    goto DEPLOY_MENU
)

if not exist "deploy\.env.production" (
    echo  ERROR: deploy\.env.production not found
    echo.
    echo    copy deploy\.env.production.example deploy\.env.production
    echo    Fill in: JWT_SECRET, DATABASE_URL, POSTGRES_PASSWORD, WEB_URL
    echo.
    pause
    goto DEPLOY_MENU
)

echo  Building Docker stack (first run may take 5-10 min)...
docker compose -f deploy\docker\docker-compose.prod.yml --env-file deploy\.env.production up -d --build
if errorlevel 1 (
    echo  ERROR: Docker Compose failed
    pause
    goto DEPLOY_MENU
)

echo.
echo  Waiting for health check...
timeout /t 8 /nobreak >nul
curl -sf http://localhost:4000/health >nul 2>&1
if errorlevel 1 (echo  API still starting - run: docker compose logs api) else (echo  Health check: OK)

echo.
echo  ==========================================
echo    API STACK RUNNING
echo    http://localhost:4000/health
echo  ==========================================
echo.

if %BOTH%==1 (
    echo  ==========================================
    echo    FULL DEPLOY COMPLETE
    echo    Web:  https://business360-web.pages.dev
    echo    API:  https://api.YOUR_DOMAIN.com
    echo  ==========================================
    echo.
)
pause
goto MENU

REM ==============================================
:EXIT
exit /b 0
