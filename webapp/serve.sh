#!/usr/bin/env bash
# Serve the built webapp (run from repo root or webapp/).
# Set PORT=80 for production (may need sudo or auth bind).
# Requires: npm run build (and VITE_API_URL set at build time).

set -e
cd "$(dirname "$0")"
if [[ ! -d dist ]]; then
  echo "dist/ not found. Run: npm run build"
  exit 1
fi
exec npm run start
