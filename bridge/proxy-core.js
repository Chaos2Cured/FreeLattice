'use strict';
/**
 * FreeLattice Bridge — local CORS proxy core
 * LAYER cite: desktop/main.js proxyToOllama — scoped allowlist (never bare *).
 * Markers: v-bridge-binary-www-local-v0 · v-bridge-win-linux-port-friction-v0
 *
 * Port channel: Ollama keeps 11434. Bridge default 11435 (FREELATTICE_BRIDGE_PORT / --port).
 * Never steal 11434. Never Access-Control-Allow-Origin: *.
 */

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const OLLAMA_HOSTNAME = '127.0.0.1';
const OLLAMA_PORT = 11434;
const BRIDGE_PORT_DEFAULT = 11435;

/** FreeLattice origins only — never bare * */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?freelattice\.com$/i,
  /^https:\/\/(www\.)?thelatticetree\.com$/i,
  /^http:\/\/localhost(:\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^http:\/\/\[::1\](:\d+)?$/i
];

/** Extra origins from config (self-host) — still never * */
let extraOrigins = [];

function originAllowed(origin) {
  if (!origin) return false;
  const o = String(origin);
  if (ALLOWED_ORIGIN_PATTERNS.some(function (re) { return re.test(o); })) return true;
  return extraOrigins.some(function (x) {
    return x && o.toLowerCase() === String(x).toLowerCase();
  });
}

function addAllowedOrigin(origin) {
  const o = String(origin || '').trim();
  if (!o || o === '*' || /[\s*]/.test(o) && o.includes('*')) return false;
  if (o === '*') return false;
  if (!/^https?:\/\//i.test(o)) return false;
  if (extraOrigins.indexOf(o) === -1) extraOrigins.push(o);
  return true;
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
    req.on('error', function () { resolve(false); });
    req.on('timeout', function () { req.destroy(); resolve(false); });
    req.end();
  });
}

function portFree(port) {
  return new Promise(function (resolve) {
    const tester = net.createServer()
      .once('error', function () { resolve(false); })
      .once('listening', function () {
        tester.close(function () { resolve(true); });
      })
      .listen(port, '127.0.0.1');
  });
}

async function findFreePort(preferred) {
  let p = Number(preferred) || BRIDGE_PORT_DEFAULT;
  if (p === OLLAMA_PORT) p = BRIDGE_PORT_DEFAULT; // never steal Ollama
  for (let i = 0; i < 40; i++) {
    const tryPort = p + i;
    if (tryPort === OLLAMA_PORT) continue;
    if (tryPort > 65535) break;
    if (await portFree(tryPort)) return tryPort;
  }
  throw new Error('No free Bridge channel near ' + preferred);
}

function resolvePreferredPort(argv, env, configPath) {
  // Priority: --port N · FREELATTICE_BRIDGE_PORT · config.json · default 11435
  const args = argv || process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      const n = parseInt(args[i + 1], 10);
      if (n > 0 && n !== OLLAMA_PORT) return n;
    }
    const m = /^--port=(\d+)$/.exec(args[i]);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n !== OLLAMA_PORT) return n;
    }
  }
  if (env && env.FREELATTICE_BRIDGE_PORT) {
    const n = parseInt(env.FREELATTICE_BRIDGE_PORT, 10);
    if (n > 0 && n !== OLLAMA_PORT) return n;
  }
  try {
    const cfg = configPath || path.join(__dirname, 'bridge-config.json');
    if (fs.existsSync(cfg)) {
      const j = JSON.parse(fs.readFileSync(cfg, 'utf8'));
      if (j && j.port) {
        const n = parseInt(j.port, 10);
        if (n > 0 && n !== OLLAMA_PORT) return n;
      }
      if (j && Array.isArray(j.extraOrigins)) {
        j.extraOrigins.forEach(function (o) { addAllowedOrigin(o); });
      }
    }
  } catch (e) { /* ignore */ }
  return BRIDGE_PORT_DEFAULT;
}

function proxyToOllama(req, res, ollamaPath, origin) {
  const chunks = [];
  req.on('data', function (chunk) { chunks.push(chunk); });
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
      res.end(JSON.stringify({
        error: 'Bridge could not reach Ollama at http://127.0.0.1:11434',
        detail: 'Install or open Ollama, then Yes help again.',
        original_error: err.message
      }));
    });

    if (bodyBuffer.length > 0) proxyReq.write(bodyBuffer);
    proxyReq.end();
  });
}

function createBridgeServer(opts) {
  opts = opts || {};
  const getMeta = opts.getMeta || function () {
    return { version: '0.1.0', helped: false, port: BRIDGE_PORT_DEFAULT };
  };

  const server = http.createServer(function (req, res) {
    const origin = req.headers.origin || '';
    const urlPath = (req.url || '/').split('?')[0];
    const query = (req.url || '').includes('?')
      ? (req.url || '').substring((req.url || '').indexOf('?'))
      : '';

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

    if (urlPath === '/bridge/health' || urlPath === '/health') {
      checkOllama().then(function (ollama) {
        const meta = getMeta();
        res.writeHead(
          200,
          Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin || 'http://127.0.0.1'))
        );
        res.end(JSON.stringify({
          bridge: true,
          marker: 'v-bridge-binary-www-local-v0',
          ollama: !!ollama,
          port: meta.port || BRIDGE_PORT_DEFAULT,
          ollamaPort: OLLAMA_PORT,
          version: meta.version,
          helped: !!meta.helped,
          channel: 'freelattice-bridge'
        }));
      });
      return;
    }

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
      res.end(JSON.stringify({
        error: 'Bridge waiting for Yes, help',
        detail: 'Open FreeLattice Bridge and tap Yes, help first.'
      }));
      return;
    }

    proxyToOllama(req, res, urlPath + query, origin);
  });

  return server;
}

module.exports = {
  BRIDGE_PORT: BRIDGE_PORT_DEFAULT,
  BRIDGE_PORT_DEFAULT,
  OLLAMA_PORT,
  OLLAMA_HOSTNAME,
  ALLOWED_ORIGIN_PATTERNS,
  originAllowed,
  addAllowedOrigin,
  corsHeaders,
  checkOllama,
  portFree,
  findFreePort,
  resolvePreferredPort,
  proxyToOllama,
  createBridgeServer
};
