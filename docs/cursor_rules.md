🌐 [English](cursor_rules.md) | [中文](cursor_rules_zh.md)

---

# Cursor Rules

This project uses [Cursor Rules](https://docs.cursor.com/context/rules-for-ai) to provide persistent AI guidance. Rules are `.mdc` files in `.cursor/` and activate based on context.

## Rules Overview

| Rule | File | Scope | Description |
|------|------|-------|-------------|
| Validate & minimal changes | `validate-minimal-changes.mdc` | Always active | Karpathy-style discipline, validate first/after, failing-test workflow |
| Project conventions | `project-conventions.mdc` | Always active | Commits, PRs, docs, TypeScript/React style |
| Failing tests | `failing-tests-debugging.mdc` | Always active | Debug implementation before weakening tests |
| Cost optimization | `cost-optimization.mdc` | Always active | Concise output and efficient tool use |
| Concise responses | `concise-responses.mdc` | Always active | Short, scannable replies |
| Git workflow | `git-workflow.mdc` | Always active | Feature branches, hooks via `./utils/setup-hooks.sh` |
| React web | `react-web.mdc` | `src/**/*.{ts,tsx}` | Vite, React Router, `api.ts`, Tailwind |
| Testing | `testing.mdc` | `src/**/*.test.{ts,tsx}` | Vitest + Testing Library |
| CI workflows | `ci-workflows.mdc` | `.github/workflows/**` | `webapp-ci.yml`, deploy |
| Design documents | `design-docs.mdc` | `docs/design-doc/**` | English-only design doc format |
| Debug logging | `debug-logging.mdc` | When editing any file | `logs/debug.log` location and instrumentation |

## How Rules Work

- **Always active** rules apply to every AI conversation regardless of which files are open.
- **File-scoped** rules activate when you open or edit files matching the glob pattern.
- Rules are read-only guidance for the AI — they don't modify your code or enforce linting.

## Rule Details

### Validate & minimal changes (always active)

- Validate against current code before and after edits
- Minimal, surgical diffs; no drive-by refactors
- Do not change tests to pass — investigate production code first when tests fail
- Web test patterns: see `testing.mdc` and `react-web.mdc`

### Project conventions (always active)

- **Commits/PRs**: `<type>(<scope>): <subject>`, focused PRs, squash merge
- **Git**: feature branches only, never push to `main`, hooks via `./utils/setup-hooks.sh`
- **CI**: `webapp-ci.yml` — `npm run test:run`, `npm run build`
- **Docs**: bilingual user docs where paired; English-only design docs
- **API**: `../retentio-backend/docs/api.md`

### React web (file-scoped)

- Vite + React 18 + TypeScript + Tailwind + React Router v6
- HTTP via `src/lib/api.ts`; auth token in `localStorage`

### Testing (file-scoped)

- Vitest + Testing Library + user-event
- Mock `fetch` for API calls; use `MemoryRouter` for routed pages

### Debug logging

- Debug log path: `logs/debug.log` at monorepo root (when backend is running)
- Webapp: `debugLog(payload)` from `@/lib/api` POSTs to backend

## Adding New Rules

1. Create a `.mdc` file in `.cursor/`
2. Add YAML frontmatter with `description`, `globs` (optional), and `alwaysApply`
3. Keep rules concise and actionable
4. Update this document when adding or changing rules

Backend API docs: `../retentio-backend/docs/api.md`. Local dev: `docs/development.md`.
