# Retentio Web Test

React + Vite web client for Retentio API testing and validation.

## Prerequisites

- Node.js 20+ (or current LTS)
- npm 10+

## Install

```bash
npm install
```

## Run in development

```bash
npm run dev          # release API (default)
npm run dev:local    # local backend
```

The app uses `VITE_API_URL` for backend requests. `npm run dev` defaults to the release API; use `dev:local` for `http://localhost:8080`.

## Configure backend URL

Use one of these options:

1. Helper script (default: release API):

```bash
./utils/run-dev.sh            # https://api.retentio.app:8443 (default)
./utils/run-dev.sh local      # http://localhost:8080

# or:
npm run dev                   # release (default)
npm run dev:local
npm run dev:release
```

1. One-off value for a single run:

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

1. Local persistent override:

- Create `.env.development.local` in this folder.
- Add:

```env
VITE_API_URL=http://localhost:8080
```

See `docs/development.md` for details and env precedence.

## Build and preview

```bash
npm run build
npm run preview
```

## Test

Unit / component (Vitest):

```bash
npm test
# or
npm run test:run
```

End-to-end (Playwright — real browser flows against the API):

```bash
npx playwright install chromium   # once per machine
# put E2E_USERNAME / E2E_PASSWORD in .env.local, then:
npm run test:e2e
npm run test:e2e:ui               # interactive debugger
```

E2E defaults to the release API (`npm run dev:release`). Override with `E2E_API_URL` / `VITE_API_URL`. Specs skip when credentials are unset (locally); CI requires `E2E_USERNAME` and `E2E_PASSWORD` secrets.
