# FreeLattice Data Proxy — Deployment

A tiny Cloudflare Worker that proxies Yahoo Finance with proper CORS headers.
Replaces unreliable free CORS proxies.

## Deploy

```bash
cd desktop/data-proxy-worker
npx wrangler deploy
```

You'll get a URL like: `https://freelattice-data.YOUR-ACCOUNT.workers.dev`

## Usage

```
GET /chart/TSLA?range=1y&interval=1d
GET /chart/BTC-USD?range=60d&interval=1h
GET /chart/AAPL?range=5d&interval=15m
```

## After Deploy

Update `docs/temperature-gauge.html` — change the proxy URL:
```javascript
const WORKER_URL = 'https://freelattice-data.YOUR-ACCOUNT.workers.dev';
```

The temperature gauge will try the worker first, then fall back to free proxies.

## Cost

Cloudflare Workers free tier: 100,000 requests/day. More than enough.
