# Run Prisma migrations for Business360
Set-Location "c:\Users\KR007\Business360"

Write-Host "Running main schema migration..."
Set-Location "packages\db"
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/business360"
npx prisma migrate dev --name init --skip-seed 2>&1
if ($LASTEXITCODE -ne 0) { Write-Error "Main migration failed"; exit 1 }
Write-Host "Main migration complete."

Set-Location "c:\Users\KR007\Business360"
Write-Host "Done. Start the API: cd apps\api && npm run dev"
