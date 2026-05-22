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

