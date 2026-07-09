# AXiM B2B Scraping Micro App

React SPA + Cloudflare Worker API deployed as a single Cloudflare Worker with static assets.

## Prerequisites

1. Node 20+ and npm.
2. A Cloudflare account.

## Install

```bash
npm ci
```

## Cloudflare setup

1. Authenticate Wrangler:

```bash
npx wrangler login
```

2. Create KV namespace for the Worker cache/session state:

```bash
npx wrangler kv namespace create KV_BINDING
```

3. Copy the returned namespace ID into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "KV_BINDING"
id = "00000000000000000000000000000000"
```

4. Set required Worker secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put EMAILIT_API_KEY
npx wrangler secret put AXIM_SERVICE_KEY
npx wrangler secret put ADMIN_PROTOCOL_KEY
```

5. (Optional but recommended) set explicit frontend origin:

```bash
npx wrangler secret put FRONTEND_URL
```

If `FRONTEND_URL` is not set, the Worker automatically uses the request origin for same-domain deploys.

## Run locally in Worker runtime

```bash
npm run cf:dev
```

## Deploy

```bash
npm run cf:deploy
```

This builds the SPA to `dist/`, deploys `worker.js`, and serves the SPA via Workers Assets with API routes under `/api/*`.
