# Retentio Webapp

React web client for login, register, and media upload/list. See [docs/design-doc/webapp.md](../docs/design-doc/webapp.md).

## Setup

```bash
npm install
cp .env.example .env   # edit .env: VITE_API_URL for local (e.g. http://localhost:8080)
```

For **production builds**, set `VITE_API_URL=https://api.wordupx.com` (e.g. in CI or your deploy config) so the built app talks to the production API.

## Run

### Development

```bash
npm run dev    # http://localhost:5173
```

### Build & serve (production)

```bash
npm run build  # output in dist/
npm run start  # serves dist/ on PORT (default 3000), SPA fallback
# Or: ./serve.sh   (from repo root or webapp/)
```

Use `PORT=80 ./serve.sh` (or `PORT=80 npm run start`) to listen on port 80. Ensure `dist/` exists (run `npm run build` first); set `VITE_API_URL` before building so the app talks to the correct API.

### Preview (local test of production build)

```bash
npm run preview
```

Backend CORS allows `http://localhost:5173` and `http://127.0.0.1:5173` for local development.
