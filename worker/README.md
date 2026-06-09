# FreeLattice Cloudflare Worker

Hosts the `/search` route consumed by `docs/modules/web-tool.js`.

## Privacy receipt

See [SECURITY.md "Web search via Cloudflare worker"](../SECURITY.md) for the full receipt. The short version:

- **No logging in worker code.** Grep this file for `console.log` / `console.error` — there are zero.
- **No caching.** `Cache-Control: no-store` on every successful response.
- **No body persistence.** KV entries hold only a request-count integer, expire after 120s.
- **URL sanitization.** 14 tracking parameters stripped from result URLs before return.
- **Cloudflare worker logs disabled** in the dashboard (Settings → Observability → Logs OFF). This is verified by Kirk at deploy time; the worker code itself can't enforce it.

## Deploy

```bash
cd worker/
cp wrangler.toml.example wrangler.toml
wrangler kv:namespace create RATE_LIMITS    # paste the returned id into wrangler.toml
wrangler secret put BRAVE_API_KEY           # paste your Brave Search API key
wrangler deploy
```

Then in FreeLattice (browser console, persists across reloads):

```js
localStorage.fl_searchEndpoint = 'https://<your-subdomain>.workers.dev/search';
```

Or hard-coded for a Tauri build, add this line BEFORE `web-tool.js` loads in `app.html`:

```html
<script>window.FL_SEARCH_ENDPOINT = 'https://<your-subdomain>.workers.dev/search';</script>
```

`FLWebTool.isAvailable()` flips to `true` the moment the placeholder check passes (no `[CC:` in the endpoint), at which point the AI invitation to emit `[FL_SEARCH:]` activates on the next message.

## Brave Search API

Free tier: 2000 queries/month. Sign up at <https://api.search.brave.com>. The key never reaches the browser — it lives only in Cloudflare secrets.

## Disabling search at runtime

Even with the endpoint configured, search can be disabled per-device:

```js
localStorage.setItem('fl_searchEnabled', 'false');
```

`FLWebTool.isAvailable()` checks this flag too. The Settings card "Allow the AI to search the web" exposes the same toggle for non-console users.
