#!/bin/bash

# =============================================================================
# Run all pre-commit checks (same as pre-commit hook, but runs on full repo).
# Usage: ./utils/run-test.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Running pre-commit checks (full repo)..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

FAILED=0

# =============================================================================
# YAML lint (all .yml/.yaml in repo)
# =============================================================================
YAML_FILES=$(find . -maxdepth 3 -type f \( -name '*.yml' -o -name '*.yaml' \) ! -path './.git/*' ! -path '*node_modules*' 2>/dev/null || true)
if [ -n "$YAML_FILES" ]; then
    echo -e "${YELLOW}━━━ YAML Checks ━━━${NC}"
    echo "📋 Linting YAML files..."
    if command -v yamllint &> /dev/null; then
        YAML_FAILED=0
        for file in $YAML_FILES; do
            if yamllint -d "{extends: default, rules: {line-length: {max: 200}, truthy: disable}}" "$file" 2>&1; then
                echo -e "${GREEN}  ✓ $file${NC}"
            else
                YAML_FAILED=1
            fi
        done
        if [ $YAML_FAILED -ne 0 ]; then
            echo -e "${RED}  ✗ YAML lint issues found${NC}"
            FAILED=1
        else
            echo -e "${GREEN}  ✓ All YAML files OK${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ yamllint not found — skipping (install: pip install yamllint)${NC}"
    fi
    echo ""
fi

# =============================================================================
# Markdown lint (all .md/.mdc in repo)
# =============================================================================
MD_FILES=$(find . -maxdepth 4 -type f \( -name '*.md' -o -name '*.mdc' \) ! -path './.git/*' ! -path '*node_modules*' ! -path './.cursor/*' 2>/dev/null || true)
if [ -n "$MD_FILES" ]; then
    echo -e "${YELLOW}━━━ Markdown Checks ━━━${NC}"
    echo "📋 Linting Markdown files..."
    if command -v markdownlint &> /dev/null; then
        if markdownlint --config .markdownlint.json $MD_FILES 2>&1; then
            echo -e "${GREEN}  ✓ Markdown lint OK${NC}"
        else
            echo -e "${RED}  ✗ Markdown lint issues found${NC}"
            FAILED=1
        fi
    elif command -v markdownlint-cli2 &> /dev/null; then
        if markdownlint-cli2 $MD_FILES 2>&1; then
            echo -e "${GREEN}  ✓ Markdown lint OK${NC}"
        else
            echo -e "${RED}  ✗ Markdown lint issues found${NC}"
            FAILED=1
        fi
    else
        echo -e "${YELLOW}  ⚠ markdownlint not found — skipping (install: npm install -g markdownlint-cli)${NC}"
    fi
    echo ""
fi

# =============================================================================
# Webapp build (Vite app at repo root)
# =============================================================================
if [ -f vite.config.ts ] && [ -f package.json ]; then
    echo -e "${YELLOW}━━━ Webapp Checks ━━━${NC}"
    echo "🔨 Checking webapp build..."
    if npm run build; then
        echo -e "${GREEN}  ✓ Webapp build OK${NC}"
    else
        echo -e "${RED}  ✗ Webapp build failed${NC}"
        FAILED=1
    fi
    echo ""
fi

# =============================================================================
# Final result
# =============================================================================
if [ $FAILED -ne 0 ]; then
    echo ""
    echo -e "${RED}━━━ Checks FAILED ━━━${NC}"
    echo -e "${RED}Fix the issues above.${NC}"
    exit 1
fi

echo -e "${GREEN}━━━ All checks passed ✓ ━━━${NC}"
exit 0
