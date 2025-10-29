param(
  [switch]$SkipDockerInstall
)

function Test-Command {
  param([string]$Name)
  $old = $ErrorActionPreference; $ErrorActionPreference = 'SilentlyContinue'
  $null = Get-Command $Name
  $ErrorActionPreference = $old
  return $?
}

Write-Host "[1/7] Ensuring backend/.env" -ForegroundColor Cyan
if (-Not (Test-Path "backend/.env")) {
  if (Test-Path "backend/env.example") {
    Copy-Item "backend/env.example" "backend/.env" -Force
  } else {
    @"
DATABASE_URL=postgresql://nimbus:nimbus@localhost:5432/nimbusdb?schema=public
JWT_SECRET=dev-secret-change
PORT=4000
"@ | Out-File -FilePath "backend/.env" -Encoding utf8 -Force
  }
}

Write-Host "[2/7] Installing npm dependencies (workspaces)" -ForegroundColor Cyan
npm install
if (-Not $?) { throw "npm install failed" }

Write-Host "[3/7] Checking Docker availability" -ForegroundColor Cyan
$dockerOk = Test-Command docker
if (-Not $dockerOk) {
  if ($SkipDockerInstall) {
    throw "Docker is not installed and -SkipDockerInstall was provided. Aborting."
  }
  if (Test-Command winget) {
    Write-Host "Docker not found. Installing Docker Desktop via winget..." -ForegroundColor Yellow
    winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
  } else {
    Write-Host "Docker not found and winget unavailable. Will use SQLite fallback for dev." -ForegroundColor Yellow
  }
}

if ($dockerOk -or (Test-Command docker)) {
  Write-Host "[4/7] Starting Docker Desktop (if not running)" -ForegroundColor Cyan
  try { $dockerInfo = docker info 2>$null } catch {}
  if (-Not $?) {
    $dockerExe = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"
    if (Test-Path $dockerExe) { Start-Process -FilePath $dockerExe | Out-Null }
  }
  Write-Host "Waiting for Docker engine..." -ForegroundColor DarkGray
  $max = 120
  for ($i=0; $i -lt $max; $i++) {
    try { docker info 1>$null 2>$null; if ($?) { break } } catch {}
    Start-Sleep -Seconds 2
  }
  docker info 1>$null 2>$null
  if (-Not $?) { Write-Host "Docker did not become ready. Falling back to SQLite for dev." -ForegroundColor Yellow; $dockerOk = $false }
}

if ($dockerOk) {
  Write-Host "[5/7] Starting Postgres (backend/docker-compose.yml)" -ForegroundColor Cyan
  Push-Location backend
  docker compose up -d db
  if (-Not $?) { Pop-Location; throw "docker compose up failed" }
  docker compose ps
  Pop-Location

  Write-Host "[6/7] Generating Prisma client and pushing schema (Postgres)" -ForegroundColor Cyan
  Push-Location backend
  npx prisma generate
  if (-Not $?) { Pop-Location; throw "prisma generate failed" }
  npx prisma db push
  if (-Not $?) { Pop-Location; throw "prisma db push failed" }
  Pop-Location
} else {
  Write-Host "[5/7] Docker unavailable. Using SQLite dev database." -ForegroundColor Yellow
  # Ensure DATABASE_URL points to sqlite file
  $envPath = Join-Path (Get-Location) "backend/.env"
  $content = Get-Content $envPath -Raw
  $content = $content -replace "(?m)^DATABASE_URL=.*$","DATABASE_URL=file:./prisma/dev.db"
  Set-Content -Path $envPath -Value $content -Encoding utf8

  Write-Host "[6/7] Generating Prisma client and pushing schema (SQLite)" -ForegroundColor Cyan
  Push-Location backend
  npx prisma generate --schema prisma/schema.sqlite.prisma
  if (-Not $?) { Pop-Location; throw "prisma generate (sqlite) failed" }
  npx prisma db push --schema prisma/schema.sqlite.prisma
  if (-Not $?) { Pop-Location; throw "prisma db push (sqlite) failed" }
  Pop-Location
}

Write-Host "[7/7] Setup completed successfully" -ForegroundColor Green
Write-Host "You can now run: 'cd backend; npm run dev' and 'cd web; npm run dev'" -ForegroundColor Green


