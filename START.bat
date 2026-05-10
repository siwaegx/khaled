@echo off
title Business360 Launcher
chcp 65001 >nul 2>&1
cls

:MENU
echo.
echo  ============================================
echo    BUSINESS360  LAUNCHER
echo  ============================================
echo    [1]  Start Development
echo    [2]  Deploy to Cloudflare
echo    [3]  Exit
echo  ============================================
echo.
choice /c 123 /n /m "  Choose: "
if errorlevel 3 goto EXIT
if errorlevel 2 goto DEPLOY_MENU
if errorlevel 1 goto DEV

REM ══════════════════════════════════════════════
:DEV
cls
echo.
echo  Starting Business360 (development)...
echo.

echo  [1/2] Generating Prisma clients...
call npx prisma generate --schema=packages/db/prisma/schema.prisma >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Core Prisma generate failed.
  pause & goto MENU
)
call npx prisma generate --schema=apps/api/prisma/tenant.prisma >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Tenant Prisma generate failed.
  pause & goto MENU
)
echo  Prisma clients ready.
echo.

echo  [2/2] Starting servers...
echo.
echo    API    http://localhost:4000
echo    Web    http://localhost:3003
echo    ERPAI  http://localhost:3001
echo.

start "Business360 API"        cmd /k "npm run dev --workspace=apps/api"
start "Business360 Web"        cmd /k "npm run dev --workspace=apps/web"
start "ERPAI Developer Agent"  cmd /k "npm run dev --workspace=erpai"
goto EXIT

REM ══════════════════════════════════════════════
:DEPLOY_MENU
cls
echo.
echo  ============================================
echo    CLOUDFLARE DEPLOY
echo  ============================================
echo    [1]  Frontend only  (Cloudflare Pages)
echo    [2]  API only       (Docker + Tunnel)
echo    [3]  Both
echo    [4]  Back
echo  ============================================
echo.
choice /c 1234 /n /m "  Choose: "
if errorlevel 4 goto MENU
if errorlevel 3 goto DEPLOY_BOTH
if errorlevel 2 goto DEPLOY_API
if errorlevel 1 goto DEPLOY_WEB

REM ══════════════════════════════════════════════
REM  Shared flags used by DEPLOY_BOTH
REM  WEB_DONE and API_DONE are set inside BUILD_WEB / BUILD_API blocks
REM ══════════════════════════════════════════════

:DEPLOY_WEB
set _BOTH=0
goto BUILD_WEB

:DEPLOY_BOTH
set _BOTH=1
goto BUILD_WEB

REM ──────────────────────────────────────────────
:BUILD_WEB
cls
echo.
echo  [Frontend] Deploying to Cloudflare Pages...
echo  (may take 2-4 minutes)
echo.

echo  [1/3] Installing Cloudflare build tools...
call npm install --workspace=apps/web --silent
if errorlevel 1 (
  echo  ERROR: npm install failed.
  pause & goto DEPLOY_MENU
)

echo  [2/3] Building for Cloudflare Pages...
cd apps\web
call npx next build
if errorlevel 1 (
  echo  ERROR: next build failed. Fix errors above and retry.
  cd ..\..
  pause & goto DEPLOY_MENU
)
call npx @cloudflare/next-on-pages
if errorlevel 1 (
  echo  ERROR: next-on-pages transformation failed.
  cd ..\..
  pause & goto DEPLOY_MENU
)

echo  [3/3] Uploading to Cloudflare Pages...
call npx wrangler pages deploy .vercel\output\static --project-name=business360-web --branch=production
set _WRANGLER_EXIT=%errorlevel%
cd ..\..

if %_WRANGLER_EXIT% neq 0 (
  echo.
  echo  ERROR: Deploy failed. Log in first:
  echo    cd apps\web ^&^& npx wrangler login
  pause & goto DEPLOY_MENU
)

echo.
echo  ============================================
echo    FRONTEND DEPLOYED!
echo  ============================================
echo.
echo    Live URL:
echo    https://business360-web.pages.dev
echo.
echo    Dashboard:
echo    https://dash.cloudflare.com  -^>  Pages  -^>  business360-web
echo  ============================================
echo.

if %_BOTH%==1 goto BUILD_API
pause
goto MENU

REM ──────────────────────────────────────────────
:DEPLOY_API
set _BOTH=0
goto BUILD_API

:BUILD_API
cls
echo.
echo  [API] Deploying via Docker + Cloudflare Tunnel...
echo.

docker info >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Docker is not running. Start Docker Desktop and retry.
  pause & goto DEPLOY_MENU
)

if not exist "deploy\.env.production" (
  echo  ERROR: deploy\.env.production not found.
  echo.
  echo  Fix:
  echo    copy deploy\.env.production.example deploy\.env.production
  echo    Then fill in JWT_SECRET, DATABASE_URL, POSTGRES_PASSWORD, WEB_URL
  echo.
  pause & goto DEPLOY_MENU
)

echo  Building and starting Docker stack...
echo  (first build may take 5-10 minutes)
echo.
docker compose -f deploy\docker\docker-compose.prod.yml --env-file deploy\.env.production up -d --build
if errorlevel 1 (
  echo  ERROR: Docker Compose failed. See output above.
  pause & goto DEPLOY_MENU
)

echo.
echo  Waiting for API health check...
timeout /t 8 /nobreak >nul
curl -sf http://localhost:4000/health >nul 2>&1
if errorlevel 1 (
  echo  API still starting — check: docker compose logs api
) else (
  echo  API health check: OK
)

echo.
echo  ============================================
echo    API STACK RUNNING!
echo  ============================================
echo.
echo    Local:       http://localhost:4000/health
echo    Via Tunnel:  https://api.YOUR_DOMAIN.com
echo                 (after Cloudflare Tunnel is configured)
echo.
echo    Logs:  docker compose -f deploy\docker\docker-compose.prod.yml logs -f
echo    Stop:  docker compose -f deploy\docker\docker-compose.prod.yml down
echo  ============================================
echo.

if %_BOTH%==1 (
  echo.
  echo  ============================================
  echo    FULL DEPLOY COMPLETE!
  echo  ============================================
  echo.
  echo    Frontend:  https://business360-web.pages.dev
  echo    API:       https://api.YOUR_DOMAIN.com
  echo.
  echo    Cloudflare Dashboard:
  echo    https://dash.cloudflare.com
  echo  ============================================
  echo.
)
pause
goto MENU

REM ══════════════════════════════════════════════
:EXIT
exit /b 0
