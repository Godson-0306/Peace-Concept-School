# Scripted DirectAdmin deploy (no File Manager).
# Usage from repo root (PowerShell):
#   $env:PCS_FTP_PASSWORD = "<password>"
#   powershell -File deploy/directadmin/deploy.ps1

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "../..")
$Frontend = Join-Path $Root "frontend"

if (-not $env:PCS_FTP_PASSWORD) {
  Write-Error "Set PCS_FTP_PASSWORD in the environment. Do not store it in git."
}

if (-not $env:PCS_FTP_HOST) { $env:PCS_FTP_HOST = "pcism.com.ng" }
if (-not $env:PCS_FTP_USER) { $env:PCS_FTP_USER = "pcismcom" }
if (-not $env:API_PROXY_ORIGIN) { $env:API_PROXY_ORIGIN = "https://api.pcism.com.ng" }

Write-Host "Building Next.js with API_PROXY_ORIGIN=$env:API_PROXY_ORIGIN"
Push-Location $Frontend
try {
  npm run build
} finally {
  Pop-Location
}

Write-Host "Uploading via FTP…"
python (Join-Path $PSScriptRoot "upload.py")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host @"

FTP finished. In DirectAdmin Terminal (or SSH) run:

  cd ~/pcs-api
  source ~/virtualenv/pcs-api/3.12/bin/activate
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput

Then Extra Features → Setup Python App → Restart
and Setup Node.js App → Restart.

Do NOT run seed_demo or sync_class_lists on production.
Historical marks live in MySQL. Do not re-load Excel result sheets.

Then warm:

  python deploy/directadmin/warm.py

DirectAdmin cron every 5 minutes:
  curl -fsS https://api.pcism.com.ng/api/health/ >/dev/null
  curl -fsS https://pcism.com.ng/api/health/ >/dev/null

"@
