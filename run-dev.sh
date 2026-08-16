#!/bin/bash
# Thin wrapper so `./run-dev.sh release` works from the repo root.
exec "$(cd "$(dirname "$0")" && pwd)/utils/run-dev.sh" "$@"
