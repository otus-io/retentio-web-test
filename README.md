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
npm run dev
```

The app uses `VITE_API_URL` for backend requests. If not set, it falls back to `http://localhost:8080`.

## Configure backend URL

Use one of these options:

1. One-off value for a single run:

```bash
VITE_API_URL=http://localhost:8080 npm run dev
```

2. Local persistent override (recommended):

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

