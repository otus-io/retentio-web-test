#!/bin/bash
# =============================================================================
# Start Vite dev server with a chosen backend API URL.
#
# Loads env files (see below), maps unprefixed API keys → VITE_*, then sets
# VITE_API_URL from the target arg.
#
# Usage:
#   ./run-dev.sh                 # release API (default)
#   ./run-dev.sh local           # http://localhost:8080
#   ./run-dev.sh release         # https://api.retentio.app:8443
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

API_LOCAL="http://localhost:8080"
API_RELEASE="https://api.retentio.app:8443"

# Optional shared keys from quality-tools (monorepo).
QUALITY_TOOLS_ENV="$(cd "$REPO_ROOT/.." && pwd)/retentio-content/quality-tools/.env"

load_env_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
    echo "Loaded env: $file"
  fi
}

# Prefer later files for the same key (set -a source overwrites).
load_env_file "$QUALITY_TOOLS_ENV"
load_env_file "$REPO_ROOT/.env"
load_env_file "$REPO_ROOT/.env.development"
load_env_file "$REPO_ROOT/.env.local"
load_env_file "$REPO_ROOT/.env.development.local"

# quality-tools/.env uses OPENAI_API_KEY / ELEVENLABS_* without VITE_ prefix.
# Vite only exposes VITE_* to the client — map when unset.
map_vite_key() {
  local vite_name="$1"
  local plain_name="$2"
  local vite_val="${!vite_name:-}"
  local plain_val="${!plain_name:-}"
  if [[ -z "${vite_val// }" && -n "${plain_val// }" ]]; then
    export "$vite_name"="$plain_val"
    echo "Mapped $plain_name → $vite_name"
  fi
}

map_vite_key VITE_OPENAI_API_KEY OPENAI_API_KEY
map_vite_key VITE_OPENAI_MODEL OPENAI_MODEL
map_vite_key VITE_ANTHROPIC_API_KEY ANTHROPIC_API_KEY
map_vite_key VITE_DEEPSEEK_API_KEY DEEPSEEK_API_KEY
map_vite_key VITE_ELEVENLABS_API_KEY ELEVENLABS_API_KEY
map_vite_key VITE_ELEVENLABS_VOICE_ID ELEVENLABS_VOICE_ID
map_vite_key VITE_ELEVENLABS_MODEL_ID ELEVENLABS_MODEL_ID
map_vite_key VITE_ELEVENLABS_STT_MODEL ELEVENLABS_STT_MODEL

echo -n "Fix-fact keys:"
for k in VITE_OPENAI_API_KEY VITE_ANTHROPIC_API_KEY VITE_DEEPSEEK_API_KEY \
  VITE_ELEVENLABS_API_KEY VITE_ELEVENLABS_VOICE_ID; do
  if [[ -n "${!k:-}" ]]; then
    echo -n " $k=set"
  else
    echo -n " $k=missing"
  fi
done
echo

usage() {
  echo "Usage: $0 [local|release]"
  echo ""
  echo "  Loads env files, maps API keys to VITE_*, then sets VITE_API_URL:"
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
