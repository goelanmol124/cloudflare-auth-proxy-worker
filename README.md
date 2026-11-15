# Cloudflare auth proxy worker

A tiny **Cloudflare Worker** that sits in front of a backend API and forwards only an allowlist of paths, and only for callers that present a shared secret. Useful when a mobile app, WebView or partner service needs to reach a few endpoints of a backend you don't want to expose directly (for example login and registration), or when the backend sits behind a host that blocks some clients.

- `x-proxy-secret` header check (constant-time comparison)
- Path allowlist (`ALLOWED_PATHS`, default `/api/login,/api/registration`)
- JSON pass-through of status and body, CORS header on responses
- `GET /health` for uptime checks

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars          # set PROXY_SECRET for local dev
# edit wrangler.toml: BACKEND_URL (and optionally ALLOWED_PATHS)
npm run dev                              # local: http://127.0.0.1:8787
npx wrangler secret put PROXY_SECRET     # production secret
npm run deploy
```

## Usage

```bash
curl -X POST https://<your-worker>.workers.dev/api/login \
  -H "x-proxy-secret: $PROXY_SECRET" -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```

Only `GET` and `POST` bodies are forwarded, and only `Content-Type`/`Accept` headers are sent upstream; extend `src/worker.ts` if your backend needs more (e.g. `Authorization`).
