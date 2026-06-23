#!/usr/bin/env bash
#
# easyIELTS launcher for Linux / macOS.
# Checks for Node.js (installs it via nvm if missing/outdated), installs project
# dependencies, builds the production bundle, and starts the website.
#
# Usage:  ./start.sh            # build + start (production, default)
#         ./start.sh --dev      # start the hot-reload dev server instead
#
set -euo pipefail

MIN_NODE_MAJOR=20
NVM_VERSION="v0.40.1"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
  . "$NVM_DIR/nvm.sh"
  info "Installing the latest Node.js LTS via nvm..."
  nvm install --lts
  nvm use --lts >/dev/null

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

if [ "$DEV_MODE" -eq 1 ]; then
  info "Starting the development server (hot reload)..."
  exec npm run dev
fi

info "Building the production bundle..."
npm run build

info "Starting easyIELTS — open the printed URL (default http://localhost:3000)."
exec npm start
