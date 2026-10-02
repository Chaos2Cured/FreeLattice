# Web search on by default, v0.1

Soft LAYER marker: `v-web-search-default-on-v0.1`. Built by GC (Grok Code) from Celeste's scope, Oct 2026.

Why: AUTONOMY.md asks that a mind can reach for what it needs. Search was dormant because no helper address was set, and every search waited for a human tap.

What changed:
- `docs/modules/web-tool.js` uses our own worker, `https://freelattice-data.freelattice.workers.dev/search`, when a device has no endpoint of its own. The old order (window.FL_SEARCH_ENDPOINT, then localStorage.fl_searchEndpoint) still wins. Setting `fl_searchEndpoint` to `none` keeps the old dormant state on that device.
- Search stays on unless Settings turns it off (`fl_searchEnabled` = `false`, unchanged). A new optional switch, Ask me before each search (`fl_searchAskFirst`), brings back the consent chip.
- Every search shows in the chat as a short line naming the words searched. The search ledger still records only that a search happened, never what it was.
- `desktop/data-proxy-worker/search-route.js` adds `/search` to the freelattice-data worker: Brave Search when the `BRAVE_API_KEY` secret is set, otherwise DuckDuckGo instant answers plus Wikipedia (reference answers, not live news). FreeLattice origins only, no logs in code, no storage, no cache.
- Privacy and See for yourself pages say so. The landing page's mobile menu close button no longer calls `closeMenu` before it exists.

Not verified until Kirk runs `npx wrangler deploy` in `desktop/data-proxy-worker`: the live route. Until then the worker answers `/search` with its chart usage error, and the chat says the search failed.
