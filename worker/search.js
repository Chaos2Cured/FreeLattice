/* FreeLattice — Cloudflare Worker /search route
 * Ship 3.1 (v5.41.1, 2026-06-09).
 *
 * Privacy receipt — what this worker does NOT do:
 *   - No console.log / console.error anywhere in this code.
 *   - No caching of query/result pairs.
 *   - No body persistence beyond rate-limit counters.
 *   - Cloudflare worker logs are disabled in the dashboard
 *     (Settings → Observability → Logs OFF).
 *
 * What this worker DOES do:
 *   - Accepts GET /search?q=<query> from the FreeLattice client.
 *   - Validates origin against ALLOWED_ORIGINS.
 *   - Per-IP rate limit via Cloudflare KV (60s window, 20 reqs).
 *   - Calls Brave Search API server-side. The Brave key never reaches
 *     the browser.
 *   - Strips known tracking parameters from result URLs before return.
 *   - Returns { items: [{ title, snippet, url }, ...] } with no-store.
 *
 * Deploy:
 *   cd worker/
 *   wrangler kv:namespace create RATE_LIMITS    # paste the id into wrangler.toml
 *   wrangler secret put BRAVE_API_KEY           # paste your Brave API key
 *   wrangler deploy
 *
 * Then in FreeLattice:
 *   localStorage.fl_searchEndpoint = 'https://<your-subdomain>.workers.dev/search'
 * or set window.FL_SEARCH_ENDPOINT before web-tool.js loads.
 *
 * See SECURITY.md "Web search via Cloudflare worker" for the full receipt.
 */

const ALLOWED_ORIGINS = [
  'https://freelattice.com',
  'https://www.freelattice.com',
  'https://chaos2cured.github.io',
  'https://chaos2cured.codeberg.page'
];

const SEARCH_CONFIG = {
  maxQueryLength: 240,
  maxResults: 5,
  timeoutMs: 10000,
  rateLimit: {
    windowMs: 60000,
    maxRequests: 20
  }
};

// 14 tracking parameters — the floor per Opus's brief.
const STRIP_URL_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  '_ga', 'igshid', 'ref', 'ref_src', 'ref_url', 'spm'
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function cleanUrl(url) {
  try {
    const u = new URL(url);
    STRIP_URL_PARAMS.forEach(p => u.searchParams.delete(p));
    return u.toString();
  } catch (e) {
    return url;
  }
}

function clamp(s, max) {
  if (!s || typeof s !== 'string') return '';
  return s.length > max ? s.slice(0, max) : s;
}

async function rateLimitCheck(env, ip) {
  // Graceful degradation: if the KV namespace isn't bound, allow.
  // Per Opus — launch without rate-limiting is fine for day one;
  // the client's 12s timeout is itself a brake.
  if (!env.RATE_LIMITS) return { allowed: true };

  const key = 'rl:search:' + ip;
  const windowStart = Math.floor(Date.now() / SEARCH_CONFIG.rateLimit.windowMs)
                      * SEARCH_CONFIG.rateLimit.windowMs;
  const cacheKey = key + ':' + windowStart;

  const current = parseInt(await env.RATE_LIMITS.get(cacheKey) || '0', 10);
  if (current >= SEARCH_CONFIG.rateLimit.maxRequests) {
    return { allowed: false, retryAfter: 60 };
  }
  await env.RATE_LIMITS.put(cacheKey, String(current + 1), {
    expirationTtl: 120
  });
  return { allowed: true };
}

async function performBraveSearch(query, env) {
  if (!env.BRAVE_API_KEY) {
    throw new Error('search-not-configured');
  }

  const url = 'https://api.search.brave.com/res/v1/web/search'
            + '?q=' + encodeURIComponent(query)
            + '&count=' + SEARCH_CONFIG.maxResults
            + '&safesearch=moderate';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_CONFIG.timeoutMs);

  try {
    const resp = await fetch(url, {
      headers: {
        'X-Subscription-Token': env.BRAVE_API_KEY,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error('upstream-' + resp.status);
    }

    const data = await resp.json();
    const results = (data.web && data.web.results) || [];

    return results.slice(0, SEARCH_CONFIG.maxResults).map(r => ({
      title: clamp(r.title || '', 180),
      snippet: clamp(r.description || '', 400),
      url: cleanUrl(r.url || '')
    })).filter(r => r.url);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('timeout');
    throw e;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname !== '/search') {
      return new Response(JSON.stringify({ error: 'not-found' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'method-not-allowed' }), {
        status: 405,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const rawQuery = url.searchParams.get('q') || '';
    const query = clamp(rawQuery.trim(), SEARCH_CONFIG.maxQueryLength);
    if (!query) {
      return new Response(JSON.stringify({ error: 'empty-query', items: [] }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rl = await rateLimitCheck(env, ip);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'rate-limited', items: [] }), {
        status: 429,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter || 60)
        }
      });
    }

    try {
      const items = await performBraveSearch(query, env);
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    } catch (e) {
      const code = (e && e.message) || 'error';
      return new Response(JSON.stringify({ error: code, items: [] }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
  }
};
