'use strict';
/**
 * FreeLattice Bridge — local CORS proxy core
 * LAYER cite: desktop/main.js proxyToOllama — scoped allowlist (never bare *).
 * Marker: v-bridge-binary-www-local-v0
 */

const http = require('http');

const OLLAMA_HOSTNAME = '127.0.0.1';
const OLLAMA_PORT = 11434;
const BRIDGE_PORT = 11435;

/** FreeLattice origins only — never bare * */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?freelattice\.com$/i,
  /^https:\/\/(www\.)?thelatticetree\.com$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^http:\/\/\[::1\](:\d+)?$/i
];

function originAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERNS.some(function (re) {
    return re.test(String(origin));
  });
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (origin && originAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function checkOllama() {
  return new Promise(function (resolve) {
    const req = http.request(
      {
        hostname: OLLAMA_HOSTNAME,
        port: OLLAMA_PORT,
        path: '/api/tags',
        method: 'GET',
        timeout: 2500
      },
      function (res) {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      }
    );
    req.on('error', function () {
      resolve(false);
    });
    req.on('timeout', function () {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function proxyToOllama(req, res, ollamaPath, origin) {
  const chunks = [];
  req.on('data', function (chunk) {
    chunks.push(chunk);
  });
  req.on('end', function () {
    const bodyBuffer = Buffer.concat(chunks);
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'connection' && lower !== 'origin') {
        forwardHeaders[key] = value;
      }
    }
    if (bodyBuffer.length > 0) {
      forwardHeaders['content-length'] = bodyBuffer.length;
    }

    const proxyReq = http.request(
      {
        hostname: OLLAMA_HOSTNAME,
        port: OLLAMA_PORT,
        path: ollamaPath,
        method: req.method,
        headers: forwardHeaders
      },
      function (proxyRes) {
        const responseHeaders = Object.assign({}, proxyRes.headers, corsHeaders(origin));
        res.writeHead(proxyRes.statusCode || 502, responseHeaders);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', function (err) {
      res.writeHead(
        502,
        Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
      );
      res.end(
        JSON.stringify({
          error: 'Bridge could not reach Ollama at http://127.0.0.1:11434',
          detail: 'Install or open Ollama, then Yes help again.',
          original_error: err.message
        })
      );
    });

    if (bodyBuffer.length > 0) proxyReq.write(bodyBuffer);
    proxyReq.end();
  });
}

function createBridgeServer(opts) {
  opts = opts || {};
  const getMeta = opts.getMeta || function () {
    return { version: '0.1.0', helped: false };
  };

  const server = http.createServer(function (req, res) {
    const origin = req.headers.origin || '';
    const urlPath = (req.url || '/').split('?')[0];
    const query = (req.url || '').includes('?')
      ? (req.url || '').substring((req.url || '').indexOf('?'))
      : '';

    // Preflight — only for allowlisted origins
    if (req.method === 'OPTIONS') {
      if (origin && !originAllowed(origin)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Origin not allowed');
        return;
      }
      res.writeHead(204, corsHeaders(origin));
      res.end();
      return;
    }

    // Health — allow no-origin (same machine / smoke) and allowlisted
    if (urlPath === '/bridge/health' || urlPath === '/health') {
      checkOllama().then(function (ollama) {
        const meta = getMeta();
        res.writeHead(
          200,
          Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin || 'http://127.0.0.1'))
        );
        res.end(
          JSON.stringify({
            bridge: true,
            marker: 'v-bridge-binary-www-local-v0',
            ollama: !!ollama,
            port: BRIDGE_PORT,
            ollamaPort: OLLAMA_PORT,
            version: meta.version,
            helped: !!meta.helped
          })
        );
      });
      return;
    }

    // Proxy only when helped (Yes, help) OR always once running — Celeste: while Bridge runs.
    // Gate: if origin present must be allowlisted; no-origin (curl) OK for local smoke.
    if (origin && !originAllowed(origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not on FreeLattice allowlist' }));
      return;
    }

    const meta = getMeta();
    if (!meta.helped) {
      res.writeHead(
        403,
        Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
      );
      res.end(
        JSON.stringify({
          error: 'Bridge waiting for Yes, help',
          detail: 'Open FreeLattice Bridge and tap Yes, help first.'
        })
      );
      return;
    }

    proxyToOllama(req, res, urlPath + query, origin);
  });

  return server;
}

module.exports = {
  BRIDGE_PORT,
  OLLAMA_PORT,
  OLLAMA_HOSTNAME,
  ALLOWED_ORIGIN_PATTERNS,
  originAllowed,
  corsHeaders,
  checkOllama,
  proxyToOllama,
  createBridgeServer
};
