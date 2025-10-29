param(
  [string]$MigrationName = "init"
)

Write-Host "Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host "Starting Postgres (Docker compose)..." -ForegroundColor Cyan
docker compose up -d

Write-Host "Copying backend env example to .env if missing..." -ForegroundColor Cyan
if (-Not (Test-Path "backend/.env")) {
  Copy-Item -Path "backend/env.example" -Destination "backend/.env"
}

Write-Host "Generating Prisma client..." -ForegroundColor Cyan
npm run prisma:generate

Write-Host "Running Prisma migration..." -ForegroundColor Cyan
npm run prisma:migrate -- $MigrationName

Write-Host "All set! Run 'npm run dev' to start both apps." -ForegroundColor Green


