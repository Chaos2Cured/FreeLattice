/**
 * FreeLattice Data Proxy — Cloudflare Worker
 *
 * Proxies Yahoo Finance API requests with proper CORS headers.
 * Deploy: wrangler deploy
 * Usage: https://YOUR-WORKER.workers.dev/chart/TSLA?range=1y&interval=1d
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Route: /chart/SYMBOL?range=1y&interval=1d
    const match = url.pathname.match(/^\/chart\/([A-Za-z0-9._^=-]+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Usage: /chart/SYMBOL?range=1y&interval=1d' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const symbol = match[1];
    const range = url.searchParams.get('range') || '1y';
    const interval = url.searchParams.get('interval') || '1d';

    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;

    try {
      const resp = await fetch(yahooUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 FreeLattice/1.0' }
      });
      const data = await resp.text();

      return new Response(data, {
        status: resp.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=60'
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
