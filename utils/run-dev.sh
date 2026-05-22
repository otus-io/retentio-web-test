#!/bin/bash
# =============================================================================
# Start Vite dev server with a chosen backend API URL.
#
# Usage:
#   ./utils/run-dev.sh           # release (default)
#   ./utils/run-dev.sh local     # http://localhost:8080
#   ./utils/run-dev.sh release   # https://api.retentio.app:8443
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

API_LOCAL="http://localhost:8080"
API_RELEASE="https://api.retentio.app:8443"

usage() {
  echo "Usage: $0 [local|release]"
  echo ""
  echo "  (none)   VITE_API_URL=$API_RELEASE  (default)"
  echo "  local    VITE_API_URL=$API_LOCAL"
  echo "  release  VITE_API_URL=$API_RELEASE"
}

case "${1:-release}" in
  local|dev)
    export VITE_API_URL="$API_LOCAL"
    ;;
  release|prod|production|"")
    export VITE_API_URL="$API_RELEASE"
    ;;
  -h|--help|help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown target: $1" >&2
    echo ""
    usage
    exit 1
    ;;
esac

echo "Starting dev server → VITE_API_URL=$VITE_API_URL"
exec npx vite
