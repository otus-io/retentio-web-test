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

2. One-off value for a single run:

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

3. Local persistent override:

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

```bash
npm test
# or
npm run test:run
```

