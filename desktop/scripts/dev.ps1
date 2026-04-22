$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backendPath = Join-Path $projectRoot 'backend'
$frontendPath = Join-Path $projectRoot 'frontend'
$desktopPath = Join-Path $projectRoot 'desktop\shell'

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

function Ensure-NodeModules([string]$path) {
  $nodeModulesPath = Join-Path $path 'node_modules'
  if (!(Test-Path $nodeModulesPath)) {
    Write-Host "Installing npm dependencies in $path ..."
    npm install --prefix $path
  }
}

function Wait-HttpReady([string]$url, [int]$maxSeconds = 60) {
  $start = Get-Date
  while ($true) {
    try {
      $resp = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        return
      }
    } catch {
      # keep waiting
    }

    if (((Get-Date) - $start).TotalSeconds -gt $maxSeconds) {
      throw "Timeout waiting for service: $url"
    }
    Start-Sleep -Seconds 1
  }
}

if (!(Test-Path $backendPath)) { throw "backend directory not found: $backendPath" }
if (!(Test-Path $frontendPath)) { throw "frontend directory not found: $frontendPath" }
if (!(Test-Path $desktopPath)) { throw "desktop shell directory not found: $desktopPath" }

Assert-CommandExists 'python'
Assert-CommandExists 'npm'

Ensure-NodeModules $frontendPath
Ensure-NodeModules $desktopPath

Write-Host 'Starting backend (FastAPI)...'
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

Write-Host 'Starting frontend (Next.js)...'
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host 'Waiting backend healthz...'
Wait-HttpReady 'http://127.0.0.1:8000/healthz' 60

Write-Host 'Waiting frontend home page...'
Wait-HttpReady 'http://127.0.0.1:3000' 90

Write-Host 'Starting desktop shell (Electron)...'
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$desktopPath'; npm run dev"

Write-Host 'Done. Opened backend/frontend/desktop terminals.'
Write-Host 'Backend: http://127.0.0.1:8000/healthz'
Write-Host 'Frontend: http://127.0.0.1:3000'
