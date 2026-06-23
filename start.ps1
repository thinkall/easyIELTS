#Requires -Version 5.1
<#
.SYNOPSIS
    easyIELTS launcher for Windows (PowerShell).
.DESCRIPTION
    Checks for Node.js (installs it via winget if missing/outdated), installs
    project dependencies, builds, and starts the website IN THE BACKGROUND.
    Re-running force-restarts: any instance already on the port is stopped first.
    Logs go to easyielts.log / easyielts.err.log and the PID to easyielts.pid.
.PARAMETER Dev
    Run the hot-reload development server (foreground) instead of a background build.
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

$LogFile = Join-Path $ScriptDir 'easyielts.log'
$ErrLogFile = Join-Path $ScriptDir 'easyielts.err.log'
$PidFile = Join-Path $ScriptDir 'easyielts.pid'

function Write-Info($m) { Write-Host "[start] $m" -ForegroundColor Cyan }
function Write-Note($m) { Write-Host "[start] $m" -ForegroundColor Yellow }
function Write-Fail($m) { Write-Host "[start] $m" -ForegroundColor Red }

# Resolve the port: an explicit $env:PORT wins, then a PORT= line in .env, then 3000.
function Get-Port {
    if ($env:PORT) { try { return [int]$env:PORT } catch {} }
    if (Test-Path .env) {
        $line = (Select-String -Path .env -Pattern '^\s*PORT=' -ErrorAction SilentlyContinue | Select-Object -Last 1).Line
        if ($line) {
            $val = ($line -replace '^\s*PORT=', '').Trim().Trim('"')
            if ($val -match '^\d+$') { return [int]$val }
        }
    }
    return 3000
}

# PIDs listening on the given TCP port.
function Get-PortOwningPids($port) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) { return @($conns.OwningProcess | Sort-Object -Unique) }
    return @()
}

# Force-restart: stop any instance already bound to the port (or our recorded PID).
function Stop-Existing($port) {
    $procIds = Get-PortOwningPids $port
    if ((@($procIds)).Count -eq 0 -and (Test-Path $PidFile)) {
        $saved = Get-Content $PidFile -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\d+$' }
        if ($saved) { $procIds = @($saved | ForEach-Object { [int]$_ }) }
    }
    if ((@($procIds)).Count -gt 0) {
        Write-Note "An instance is already running (PID $($procIds -join ', ')) - stopping it for a clean restart."
        foreach ($procId in $procIds) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Seconds 1
    }
    Remove-Item $PidFile -ErrorAction SilentlyContinue
}

# Poll for up to ~20s for the server to start listening.
function Wait-UntilUp($port) {
    for ($i = 0; $i -lt 40; $i++) {
        if ((Get-PortOwningPids $port).Count -gt 0) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

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

$port = Get-Port
$env:PORT = "$port"
# Bind to all interfaces by default so the site is reachable via the machine's IP
# or a domain (not just localhost). Override by setting $env:HOST before running.
if (-not $env:HOST) { $env:HOST = '0.0.0.0' }

if ($Dev) {
    Stop-Existing $port
    Write-Info "Starting the development server (hot reload) on port $port - foreground, Ctrl-C to stop."
    npm run dev
    exit $LASTEXITCODE
}

Write-Info "Building the production bundle..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Build failed."
    exit 1
}

Stop-Existing $port
Write-Info "Starting easyIELTS in the background on port $port..."
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = 'npm.cmd' }
$proc = Start-Process -FilePath $npmCmd -ArgumentList 'start' -WorkingDirectory $ScriptDir `
    -WindowStyle Hidden -RedirectStandardOutput $LogFile -RedirectStandardError $ErrLogFile -PassThru
$proc.Id | Out-File -FilePath $PidFile -Encoding ascii

if (Wait-UntilUp $port) {
    $listenPids = Get-PortOwningPids $port
    if ($listenPids.Count -gt 0) { ($listenPids -join "`r`n") | Out-File -FilePath $PidFile -Encoding ascii }
    $shown = if ($listenPids.Count -gt 0) { $listenPids -join ', ' } else { $proc.Id }
    Write-Info "OK - easyIELTS is running in the background."
    Write-Info "    Local:  http://localhost:$port"
    Write-Info "    Public: http://<this-machine-ip-or-domain>:$port  (HOST=$($env:HOST); open the port in your firewall)"
    Write-Info "    Logs:  $LogFile  (errors: $ErrLogFile)"
    Write-Info "    PID:   $shown  (stored in $PidFile)"
    Write-Info "    Stop:  re-run this script to restart, or: Stop-Process -Id $shown -Force"
} else {
    Write-Fail "easyIELTS did not come up within the timeout. Recent logs:"
    if (Test-Path $LogFile) { Get-Content $LogFile -Tail 25 }
    if (Test-Path $ErrLogFile) { Get-Content $ErrLogFile -Tail 25 }
    exit 1
}
