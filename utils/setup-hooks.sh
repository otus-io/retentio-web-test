#!/bin/bash

# =============================================================================
# Setup script to install git hooks for retentio-webapp
# Run this once after cloning the repo: ./utils/setup-hooks.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Repo root is one level up from utils/ (retentio-webapp), where .git lives
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"

if [ ! -d "$HOOKS_DIR" ]; then
    echo "Error: Not a git repo or .git/hooks missing: $HOOKS_DIR"
    exit 1
fi

echo "Installing git hooks..."

# Copy pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"
echo "✓ pre-commit hook installed"

# Copy pre-push hook (optional)
if [ -f "$SCRIPT_DIR/pre-push" ]; then
    cp "$SCRIPT_DIR/pre-push" "$HOOKS_DIR/pre-push"
    chmod +x "$HOOKS_DIR/pre-push"
    echo "✓ pre-push hook installed"
else
    echo "○ pre-push hook not found (optional, skipped)"
fi

echo ""
echo "Done. Hooks are installed in .git/hooks/"
echo "To skip hooks temporarily: git commit --no-verify / git push --no-verify"
