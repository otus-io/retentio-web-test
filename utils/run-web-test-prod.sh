#!/bin/bash

# Serve the Vite production build (expects `npm run build` already done).
# Usage: from repo root: ./utils/run-web-test-prod.sh
#        or: bash /path/to/retentio-web-test/utils/run-web-test-prod.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

export NODE_ENV=production

# systemd does not load login shells; mirror test-build-deploy.yml Node setup.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use 2>/dev/null || nvm use default 2>/dev/null || true
fi
if [ -f "$HOME/.profile" ]; then
  # shellcheck source=/dev/null
  . "$HOME/.profile"
fi
export PATH="$HOME/.npm-global/bin:/usr/local/bin:$PATH"

REQUIRED_NODE_VERSION="20.0.0"

if ! command -v node >/dev/null 2>&1; then
  echo "node not found on PATH" >&2
  exit 1
fi

NODE_VERSION="$(node -v | sed 's/^v//')"
if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
  echo "node $NODE_VERSION found; require >=$REQUIRED_NODE_VERSION" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found on PATH" >&2
  exit 1
fi

if [ ! -d "$REPO_ROOT/dist" ] || [ ! -f "$REPO_ROOT/dist/index.html" ]; then
  echo "Missing dist/ build output; run npm run build before starting" >&2
  exit 1
fi

exec npm run start
