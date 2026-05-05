# Setup Business360 PostgreSQL database
$pgBin = (Get-ChildItem "C:\Program Files\PostgreSQL" -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1)
if (-not $pgBin) { Write-Error "PostgreSQL not found in C:\Program Files\PostgreSQL"; exit 1 }
$psql = Join-Path $pgBin.FullName "bin\psql.exe"
$pgCtl = Join-Path $pgBin.FullName "bin\pg_ctl.exe"

Write-Host "Found PostgreSQL at $($pgBin.FullName)"
Write-Host "Ensuring service is running..."

# Start service if not running
$svc = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($svc -and $svc.Status -ne "Running") {
    Start-Service $svc.Name -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
}

# Set password + create database
$env:PGPASSWORD = "password"
& $psql -U postgres -c "ALTER USER postgres PASSWORD 'password';" 2>&1
& $psql -U postgres -c "SELECT 1 FROM pg_database WHERE datname='business360';" 2>&1 | Out-Null
$exists = & $psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='business360';"
if ($exists -ne "1") {
    & $psql -U postgres -c "CREATE DATABASE business360;"
    Write-Host "Created database 'business360'"
} else {
    Write-Host "Database 'business360' already exists"
}

Write-Host "Database setup complete!"
