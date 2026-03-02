#!/usr/bin/env node
// ============================================
// FreeLattice — Local Server (Node.js)
// Zero dependencies. Just run: node server.js
// ============================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- Configuration ---
const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname; // Serve files from the same folder as this script
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// Parse Ollama host into components
const ollamaUrl = new URL(OLLAMA_HOST);
const OLLAMA_HOSTNAME = ollamaUrl.hostname;
const OLLAMA_PORT = parseInt(ollamaUrl.port, 10) || 11434;

// --- MIME Types ---
const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.mp3':  'audio/mpeg',
  '.wav':  'audio/wav',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4':  'video/mp4',
  '.txt':  'text/plain',
  '.md':   'text/markdown',
  '.xml':  'application/xml',
  '.pdf':  'application/pdf',
  '.zip':  'application/zip',
  '.wasm': 'application/wasm'
};

// --- Get local network IP ---
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

// --- Check if Ollama is running ---
function checkOllama() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: OLLAMA_HOSTNAME,
      port: OLLAMA_PORT,
      path: '/api/tags',
      method: 'GET',
      timeout: 3000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { resolve(true); });
    });
    req.on('error', () => { resolve(false); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// --- Proxy request to Ollama ---
function proxyToOllama(req, res, ollamaPath) {
  // Collect request body
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(chunks);

    // Build headers to forward (skip host and connection)
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (lower !== 'host' && lower !== 'connection') {
        forwardHeaders[key] = value;
      }
    }
    if (bodyBuffer.length > 0) {
      forwardHeaders['content-length'] = bodyBuffer.length;
    }

    const proxyReq = http.request({
      hostname: OLLAMA_HOSTNAME,
      port: OLLAMA_PORT,
      path: ollamaPath,
      method: req.method,
      headers: forwardHeaders
    }, (proxyRes) => {
      // Forward status and headers from Ollama
      const responseHeaders = Object.assign({}, proxyRes.headers);
      // Add CORS headers
      responseHeaders['Access-Control-Allow-Origin'] = '*';
      responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

      res.writeHead(proxyRes.statusCode, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        error: 'Ollama proxy error: Could not connect to Ollama at ' + OLLAMA_HOST,
        detail: 'Make sure Ollama is running. Install from https://ollama.com if needed.',
        original_error: err.message
      }));
    });

    if (bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });
}

// --- Create the server ---
const server = http.createServer((req, res) => {
  // CORS headers — allows API calls from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse the requested URL
  let urlPath = req.url.split('?')[0]; // Remove query strings

  // --- Ollama Proxy: /ollama/* → Ollama server ---
  if (urlPath.startsWith('/ollama/') || urlPath === '/ollama') {
    const ollamaPath = urlPath.replace(/^\/ollama/, '') || '/';
    // Re-attach query string if present
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    proxyToOllama(req, res, ollamaPath + queryString);
    return;
  }

  // --- Static file serving ---
  if (urlPath === '/') urlPath = '/index.html';

  // Security: prevent directory traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT, safePath);

  // Make sure we're not serving files outside the root directory
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Read and serve the file
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + urlPath);
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

// --- Start listening ---
server.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('  🌐 FreeLattice Server running!');
  console.log('');
  console.log('     Local:   http://localhost:' + PORT);
  console.log('     Network: http://' + localIP + ':' + PORT);
  console.log('');

  // Check for Ollama
  const ollamaRunning = await checkOllama();
  if (ollamaRunning) {
    console.log('  🤖 Ollama detected at ' + OLLAMA_HOST + ' — proxy enabled!');
    console.log('     Proxy route: http://localhost:' + PORT + '/ollama/* → ' + OLLAMA_HOST + '/*');
  } else {
    console.log('  ℹ️  Ollama not detected. Install from ollama.com for local AI.');
    console.log('     (The proxy route /ollama/* is still active — start Ollama anytime.)');
  }

  console.log('');
  console.log('     Share the Network URL with your phone or other devices on your WiFi');
  console.log('');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});

// --- Graceful shutdown ---
process.on('SIGINT', () => {
  console.log('\n  Server stopped. Goodbye! 👋\n');
  process.exit(0);
});
