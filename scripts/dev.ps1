param(
  [int]$ApiPort = 8000,
  [switch]$Ngrok
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Find-Python {
  $root = Resolve-RepoRoot
  $venvPython = Join-Path $root ".venv\\Scripts\\python.exe"
  if (Test-Path $venvPython) { return $venvPython }

  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $cmd = Get-Command py -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  throw "Could not find Python. Create/activate a venv at .\\.venv\\ or install Python."
}

function Find-Npm {
  $cmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "Could not find npm. Install Node.js (includes npm) and ensure it's on PATH."
}

$root = Resolve-RepoRoot
$python = Find-Python
$npm = Find-Npm

Write-Host "[dev] Repo root: $root"
Write-Host "[dev] API:      http://127.0.0.1:$ApiPort"
Write-Host "[dev] Webhook:  http://127.0.0.1:$ApiPort/elevenlabs/webhook"
Write-Host "[dev] Frontend: http://localhost:3000"
if ($Ngrok) { Write-Host "[dev] Ngrok:    exposing API port $ApiPort" }

Start-Process `
  -WorkingDirectory $root `
  -FilePath $python `
  -ArgumentList @("-m", "uvicorn", "server.api:app", "--reload", "--port", "$ApiPort") `
  -WindowStyle Normal

Start-Process `
  -WorkingDirectory (Join-Path $root "next-js-meeting-dashboard") `
  -FilePath $npm `
  -ArgumentList @("run", "dev") `
  -WindowStyle Normal

if ($Ngrok) {
  $ngrok = Get-Command ngrok -ErrorAction SilentlyContinue
  if (-not $ngrok) {
    throw "ngrok not found on PATH. Install ngrok or run without -Ngrok."
  }
  Start-Process -FilePath $ngrok.Source -ArgumentList @("http", "$ApiPort") -WindowStyle Normal
}

Write-Host "[dev] Started processes. Use Ctrl+C in each window to stop."
