/**
 * FreeLattice search route for the freelattice-data worker.
 * Soft LAYER marker: v-web-search-default-on-v0.1
 *
 * GET /search?q=words  ->  { items: [{ title, snippet, url }], source }
 *
 * Where a search goes:
 *   - If the BRAVE_API_KEY secret is set on this worker, the words go to
 *     Brave Search and come back as ordinary web results (source "brave").
 *   - If it is not set, the words go to two keyless public APIs instead:
 *     DuckDuckGo's Instant Answer API and Wikipedia's search API
 *     (source "duckduckgo+wikipedia"). These are reference answers, not
 *     live news, and the app says so.
 *
 * What this code does NOT do: no console logging, no storage, no cache
 * (Cache-Control no-store), no cookies. The query exists only for the
 * length of the request. Cloudflare's own dashboard logs are a setting
 * this code cannot prove; turn them off in the dashboard.
 *
 * Browser access is limited to FreeLattice's own pages (ALLOWED_ORIGINS);
 * the chart route in worker.js is unchanged.
 */

const ALLOWED_ORIGINS = [
  'https://freelattice.com',
  'https://www.freelattice.com',
  'https://chaos2cured.github.io',
  'https://chaos2cured.codeberg.page'
];
// The desktop app serves the page from 127.0.0.1 (desktop/main.js).
const LOCAL_ORIGIN_RE = /^http:\/\/127\.0\.0\.1(:\d{1,5})?$/;

const MAX_QUERY = 240;
const MAX_RESULTS = 5;
const TIMEOUT_MS = 9000;
const UA = 'FreeLattice-search/0.1 (https://freelattice.com)';

const STRIP_URL_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  '_ga', 'igshid', 'ref', 'ref_src', 'ref_url', 'spm'
];

function corsHeaders(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || LOCAL_ORIGIN_RE.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: Object.assign({}, headers, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    })
  });
}

function clamp(s, max) {
  s = typeof s === 'string' ? s : '';
  return s.length > max ? s.slice(0, max) : s;
}

function plain(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function cleanUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return '';
    STRIP_URL_PARAMS.forEach(p => x.searchParams.delete(p));
    return x.toString();
  } catch (e) { return ''; }
}

async function getJson(url, headers) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, { headers: headers, signal: controller.signal });
    if (!resp.ok) throw new Error('upstream-' + resp.status);
    return await resp.json();
  } finally {
    clearTimeout(t);
  }
}

async function braveSearch(q, key) {
  const data = await getJson(
    'https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) +
      '&count=' + MAX_RESULTS + '&safesearch=moderate',
    { 'X-Subscription-Token': key, 'Accept': 'application/json' }
  );
  const rows = (data && data.web && data.web.results) || [];
  return rows.map(r => ({
    title: clamp(plain(r.title), 180),
    snippet: clamp(plain(r.description), 400),
    url: cleanUrl(r.url || '')
  }));
}

async function duckSearch(q) {
  const data = await getJson(
    'https://api.duckduckgo.com/?q=' + encodeURIComponent(q) +
      '&format=json&no_html=1&skip_disambig=1&t=freelattice',
    { 'User-Agent': UA, 'Accept': 'application/json' }
  );
  const out = [];
  if (data && data.AbstractText && data.AbstractURL) {
    out.push({ title: clamp(plain(data.Heading || q), 180),
               snippet: clamp(plain(data.AbstractText), 400),
               url: cleanUrl(data.AbstractURL) });
  }
  if (data && data.Answer && typeof data.Answer === 'string') {
    out.push({ title: 'Instant answer', snippet: clamp(plain(data.Answer), 400),
               url: 'https://duckduckgo.com/?q=' + encodeURIComponent(q) });
  }
  return out;
}

async function wikiSearch(q) {
  const data = await getJson(
    'https://en.wikipedia.org/w/rest.php/v1/search/page?q=' + encodeURIComponent(q) +
      '&limit=' + MAX_RESULTS,
    { 'User-Agent': UA, 'Api-User-Agent': UA, 'Accept': 'application/json' }
  );
  const pages = (data && data.pages) || [];
  return pages.map(p => ({
    title: clamp(plain(p.title), 180),
    snippet: clamp(plain((p.description ? p.description + '. ' : '') + (p.excerpt || '')), 400),
    url: cleanUrl('https://en.wikipedia.org/wiki/' + encodeURIComponent(String(p.key || '')))
  }));
}

export async function handleSearch(request, env) {
  const headers = corsHeaders(request.headers.get('Origin') || '');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers });
  if (request.method !== 'GET') return reply({ error: 'method-not-allowed', items: [] }, 405, headers);

  const url = new URL(request.url);
  const q = clamp((url.searchParams.get('q') || '').trim(), MAX_QUERY);
  if (!q) return reply({ error: 'empty-query', items: [], usage: '/search?q=words' }, 400, headers);

  let items = [];
  let source = '';
  if (env && env.BRAVE_API_KEY) {
    try { items = await braveSearch(q, env.BRAVE_API_KEY); source = 'brave'; }
    catch (e) { items = []; }
  }
  if (!items.length) {
    const both = await Promise.allSettled([duckSearch(q), wikiSearch(q)]);
    both.forEach(r => { if (r.status === 'fulfilled') items = items.concat(r.value); });
    source = 'duckduckgo+wikipedia';
  }
  const seen = {};
  items = items.filter(it => {
    if (!it.url || seen[it.url]) return false;
    seen[it.url] = true;
    return true;
  }).slice(0, MAX_RESULTS);
  return reply({ items: items, source: source }, 200, headers);
}
