#Requires -Version 5.1
<#
.SYNOPSIS
    easyIELTS launcher for Windows (PowerShell).
.DESCRIPTION
    Checks for Node.js (installs it via winget if missing/outdated), installs
    project dependencies, builds the production bundle, and starts the website.
.PARAMETER Dev
    Run the hot-reload development server instead of a production build.
.EXAMPLE
    .\start.ps1
.EXAMPLE
    .\start.ps1 -Dev
#>
param(
    [switch]$Dev
)

$ErrorActionPreference = 'Stop'
$MinNodeMajor = 20

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

function Write-Info($m) { Write-Host "[start] $m" -ForegroundColor Cyan }
function Write-Note($m) { Write-Host "[start] $m" -ForegroundColor Yellow }
function Write-Fail($m) { Write-Host "[start] $m" -ForegroundColor Red }

function Get-NodeMajor {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) { return 0 }
    try {
        $v = (& node -v).Trim().TrimStart('v')
        return [int]($v.Split('.')[0])
    } catch { return 0 }
}

function Update-SessionPath {
    # Pick up a freshly-installed Node.js without requiring a new terminal.
    $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Install-NodeViaWinget {
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $winget) {
        Write-Fail "winget is not available. Please install Node.js >= $MinNodeMajor from https://nodejs.org/ and re-run this script."
        exit 1
    }
    Write-Info "Installing Node.js LTS via winget..."
    winget install --id OpenJS.NodeJS.LTS -e --source winget `
        --accept-package-agreements --accept-source-agreements
    Update-SessionPath
}

function Ensure-Node {
    if ((Get-NodeMajor) -ge $MinNodeMajor) {
        Write-Info "Node $(node -v) detected."
        return
    }

    if (Get-Command node -ErrorAction SilentlyContinue) {
        Write-Note "Node.js $(node -v) is older than the required v$MinNodeMajor."
    } else {
        Write-Note "Node.js was not found."
    }

    Install-NodeViaWinget

    if ((Get-NodeMajor) -lt $MinNodeMajor) {
        Write-Fail "Node.js install did not complete. Open a NEW terminal (so PATH refreshes) and re-run, or install manually from https://nodejs.org/."
        exit 1
    }
    Write-Info "Node $(node -v) ready."
}

Ensure-Node

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm is not available even after the Node.js setup. Aborting."
    exit 1
}

# Bootstrap an .env so the server has its (optional) configuration file.
if (-not (Test-Path .env) -and -not (Test-Path .env.local) -and (Test-Path .env.example)) {
    Write-Info "Creating .env from .env.example - edit it to add your API keys (all optional)."
    Copy-Item .env.example .env
}

# Install dependencies. Prefer a clean, reproducible install from the lockfile.
if (Test-Path package-lock.json) {
    Write-Info "Installing dependencies (npm ci)..."
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Note "npm ci failed; falling back to npm install."
        npm install
    }
} else {
    Write-Info "Installing dependencies (npm install)..."
    npm install
}
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Dependency installation failed."
    exit 1
}

if ($Dev) {
    Write-Info "Starting the development server (hot reload)..."
    npm run dev
    exit $LASTEXITCODE
}

Write-Info "Building the production bundle..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Build failed."
    exit 1
}

Write-Info "Starting easyIELTS - open the printed URL (default http://localhost:3000)."
npm start
exit $LASTEXITCODE
