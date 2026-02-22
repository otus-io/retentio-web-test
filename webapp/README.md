# Retentio Webapp

React web client for login, register, and media upload/list. See [docs/design-doc/webapp.md](../docs/design-doc/webapp.md).

## Setup

```bash
npm install
cp .env.example .env   # set VITE_API_URL=http://localhost:8080 for local backend
```

## Run

```bash
npm run dev    # http://localhost:5173
npm run build  # output in dist/
npm run preview
```

Backend CORS allows `http://localhost:5173` and `http://127.0.0.1:5173` for local development.
