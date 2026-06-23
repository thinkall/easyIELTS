#!/usr/bin/env bash
#
# easyIELTS launcher for Linux / macOS.
# Checks for Node.js (installs it via nvm if missing/outdated), installs project
# dependencies, builds, and starts the website IN THE BACKGROUND. Re-running force-
# restarts: any instance already on the port is stopped first. Logs go to
# easyielts.log and the background PID to easyielts.pid.
#
# Usage:  ./start.sh            # build + start in background (production, default)
#         ./start.sh --dev      # run the hot-reload dev server in the foreground
#         kill $(cat easyielts.pid)   # stop the background server
#
set -euo pipefail

MIN_NODE_MAJOR=20
NVM_VERSION="v0.40.1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOG_FILE="$SCRIPT_DIR/easyielts.log"
PID_FILE="$SCRIPT_DIR/easyielts.pid"

DEV_MODE=0
for arg in "$@"; do
  case "$arg" in
    --dev) DEV_MODE=1 ;;
    -h|--help)
      echo "Usage: ./start.sh [--dev]"; echo "  --dev   run the development server (hot reload) instead of a production build"
      exit 0 ;;
    *) echo "[start] Unknown option: $arg" >&2; exit 1 ;;
  esac
done

info() { printf '\033[1;34m[start]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[start]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[start]\033[0m %s\n' "$*" >&2; }

# Resolve the port the server will listen on: an explicit $PORT env wins, then a
# PORT= line in .env, then the default 3000.
resolve_port() {
  if [ -n "${PORT:-}" ]; then echo "$PORT"; return; fi
  local p=""
  if [ -f .env ]; then
    p="$(grep -E '^[[:space:]]*PORT=' .env 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d ' \t\r"')"
  fi
  echo "${p:-3000}"
}

# Print PIDs listening on the given TCP port (best-effort; needs lsof or fuser).
port_pids() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser "${port}/tcp" 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' || true
  fi
}

# Is something serving on the port yet? (port listener, or an HTTP response).
is_up() {
  local port="$1"
  [ -n "$(port_pids "$port")" ] && return 0
  if command -v curl >/dev/null 2>&1; then
    curl -fsS -o /dev/null --max-time 2 "http://localhost:${port}/" 2>/dev/null && return 0
  fi
  return 1
}

# Force-restart: stop any instance already bound to the port (or our recorded PID).
stop_existing() {
  local port="$1" pids
  pids="$(port_pids "$port" | tr '\n' ' ')"
  if [ -z "${pids// }" ] && [ -f "$PID_FILE" ]; then
    pids="$(cat "$PID_FILE" 2>/dev/null || true)"
  fi
  if [ -n "${pids// }" ]; then
    warn "An instance is already running (PID(s): ${pids}) — stopping it for a clean restart."
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 1
    local left
    left="$(port_pids "$port" | tr '\n' ' ')"
    if [ -n "${left// }" ]; then
      # shellcheck disable=SC2086
      kill -9 ${left} 2>/dev/null || true
      sleep 1
    fi
  fi
  rm -f "$PID_FILE" 2>/dev/null || true
}

# Poll for up to ~20s for the server to come up.
wait_until_up() {
  local port="$1" tries=0
  while [ "$tries" -lt 40 ]; do
    is_up "$port" && return 0
    sleep 0.5
    tries=$((tries + 1))
  done
  return 1
}

node_major() {
  if command -v node >/dev/null 2>&1; then
    node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1
  else
    echo 0
  fi
}

ensure_node() {
  if [ "$(node_major)" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null; then
    info "Node $(node -v) detected."
    return
  fi

  if command -v node >/dev/null 2>&1; then
    warn "Node.js $(node -v) is older than the required v${MIN_NODE_MAJOR}."
  else
    warn "Node.js was not found."
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    info "Installing nvm ${NVM_VERSION} (Node Version Manager)..."
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    elif command -v wget >/dev/null 2>&1; then
      wget -qO- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    else
      err "Neither curl nor wget is available. Please install Node.js >= ${MIN_NODE_MAJOR} from https://nodejs.org/ and re-run."
      exit 1
    fi
  fi

  # shellcheck disable=SC1090
  # nvm.sh is not written to be safe under `set -u` (it references unbound vars
  # such as PROVIDED_VERSION), so relax nounset while loading and using nvm.
  set +u
  . "$NVM_DIR/nvm.sh"
  info "Installing the latest Node.js LTS via nvm..."
  nvm install --lts
  nvm use --lts >/dev/null
  set -u

  if [ "$(node_major)" -lt "$MIN_NODE_MAJOR" ] 2>/dev/null; then
    err "Node.js installation failed or the version is still below v${MIN_NODE_MAJOR}."
    exit 1
  fi
  info "Node $(node -v) ready."
}

ensure_node

if ! command -v npm >/dev/null 2>&1; then
  err "npm is not available even after the Node.js setup. Aborting."
  exit 1
fi

# Bootstrap an .env so the server has its (optional) configuration file.
if [ ! -f .env ] && [ ! -f .env.local ] && [ -f .env.example ]; then
  info "Creating .env from .env.example — edit it to add your API keys (all optional)."
  cp .env.example .env
fi

# Install dependencies. Prefer a clean, reproducible install from the lockfile.
if [ -f package-lock.json ]; then
  info "Installing dependencies (npm ci)..."
  if ! npm ci; then
    warn "npm ci failed; falling back to npm install."
    npm install
  fi
else
  info "Installing dependencies (npm install)..."
  npm install
fi

PORT="$(resolve_port)"
export PORT
# Bind to all interfaces by default so the site is reachable via the machine's IP
# or a domain (not just localhost). Override with e.g. HOST=127.0.0.1 ./start.sh.
export HOST="${HOST:-0.0.0.0}"

if [ "$DEV_MODE" -eq 1 ]; then
  stop_existing "$PORT"
  info "Starting the development server (hot reload) on port ${PORT} — foreground, Ctrl-C to stop."
  exec npm run dev
fi

info "Building the production bundle..."
npm run build

stop_existing "$PORT"
info "Starting easyIELTS in the background on port ${PORT}..."
if command -v setsid >/dev/null 2>&1; then
  setsid npm start >"$LOG_FILE" 2>&1 </dev/null &
else
  nohup npm start >"$LOG_FILE" 2>&1 </dev/null &
fi
echo "$!" >"$PID_FILE"

if wait_until_up "$PORT"; then
  listen_pids="$(port_pids "$PORT" | tr '\n' ' ')"
  if [ -n "${listen_pids// }" ]; then echo "${listen_pids}" >"$PID_FILE"; fi
  info "✓ easyIELTS is running in the background."
  info "    Local:  http://localhost:${PORT}"
  info "    Public: http://<this-machine-ip-or-domain>:${PORT}  (HOST=${HOST}; open the port in your firewall / cloud security group)"
  info "    Logs:  ${LOG_FILE}  (tail -f to follow)"
  info "    PID:   $(cat "$PID_FILE")  (stored in ${PID_FILE})"
  info "    Stop:  re-run this script to restart, or: kill \$(cat \"${PID_FILE}\")"
else
  err "easyIELTS did not come up within the timeout. Recent logs:"
  tail -n 25 "$LOG_FILE" >&2 2>/dev/null || true
  exit 1
fi
