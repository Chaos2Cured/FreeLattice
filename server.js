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
server.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.log('');
  console.log('  🌐 FreeLattice Server running!');
  console.log('');
  console.log('     Local:   http://localhost:' + PORT);
  console.log('     Network: http://' + localIP + ':' + PORT);
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
