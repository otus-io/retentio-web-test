# Cursor Rules

Rules live in `.cursor/rules/`. Project skill: `.cursor/skills/validate-minimal-changes/SKILL.md`

| Rule | File | Scope | Description |
|------|------|-------|-------------|
| Validate & minimal changes | `validate-minimal-changes.mdc` | Always | Validate first/after, minimal diffs, fix prod not tests |
| Project conventions | `project-conventions.mdc` | Always | Commits, PRs, bilingual docs |
| Failing tests | `failing-tests-debugging.mdc` | Always | Debug implementation before weakening tests |
| React web | `react-web.mdc` | `src/**/*.{ts,tsx}` | Vite, React Router, api.ts, Tailwind |
| Testing | `testing.mdc` | `src/**/*.test.{ts,tsx}` | Vitest + Testing Library |
| Git workflow | `git-workflow.mdc` | Always | Feature branches, no direct push to `main` |
| CI workflows | `ci-workflows.mdc` | `.github/workflows/**` | GitHub Actions |
| Design docs | `design-docs.mdc` | `docs/design-doc/**` | English-only design doc format |
| Cost / concise | `cost-optimization.mdc`, `concise-responses.mdc` | Always | Token efficiency, brief replies |
| Debug logging | `debug-logging.mdc` | `**/*` | Optional debug log paths |

Backend API docs: `../retentio-backend/docs/api.md` (or deployed API). Local dev: `docs/development.md`.
