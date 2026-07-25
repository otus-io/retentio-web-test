# Development Guide

## Backend URL for `npm run dev`

This app reads backend base URL from `VITE_API_URL` (Vite env var).

- Source reference: `src/lib/api.ts`
- Default when unset: `http://localhost:8080`

### Option A: helper script (recommended for toggling)

```bash
./utils/run-dev.sh            # release API (default)
./utils/run-dev.sh local      # http://localhost:8080
./utils/run-dev.sh release    # https://api.retentio.app:8443

# or via npm:
npm run dev                   # release (default)
npm run dev:local
npm run dev:release
```

### Option B: one-off command

Use this when you want a temporary value:

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

### Option C: local file override

Create `.env.development.local` in project root:

```env
VITE_API_URL=http://localhost:8080
```

Then run:

```bash
npm run dev
```

`.env.development.local` is intended for machine-specific settings and should stay uncommitted.

## Vite env precedence (dev)

When running `npm run dev` (`vite`), env values are resolved in this order (later wins):

1. `.env`
2. `.env.local`
3. `.env.development`
4. `.env.development.local`
5. Shell environment variables from command line

Because this repo defines `VITE_API_URL` in `.env.development`, use `.env.development.local` to override it locally.

## Playwright E2E

Browser tests live in `tests/e2e/` and drive the Vite app like a user (tags, decks, facts).

```bash
npx playwright install chromium   # once per machine
npm run test:e2e
```

Put credentials in **`.env.local`** (gitignored; loaded automatically by Playwright):

```env
E2E_USERNAME=your-test-user
E2E_PASSWORD=your-test-password
```

Or export them for a one-off run:

```bash
E2E_USERNAME=youruser E2E_PASSWORD=yourpass npm run test:e2e
```

| Variable | Purpose |
|----------|---------|
| `E2E_USERNAME` / `E2E_PASSWORD` | Required to run authenticated flows |
| `E2E_API_URL` | Backend base URL (default: release API) |
| `PLAYWRIGHT_TEST_BASE_URL` | App URL (default: `http://localhost:5173` locally, `:3000` in CI) |

Without credentials, authenticated specs are skipped (only the invalid-login smoke runs). Global setup logs in via the API, clears the E2E user’s decks/tags, and writes `tests/e2e/.auth-state.json` (`localStorage` key `wordupx_token`). Do not commit that file.
