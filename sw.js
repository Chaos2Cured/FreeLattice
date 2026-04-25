// FreeLattice Service Worker — Offline Mode
// Cache-first for app shell, network-first for index.html and API calls
// API calls are never cached
// VERSION: Must match version.json — update both together

const CACHE_NAME = 'freelattice-v5.8.0';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './modules/fractal-garden.js',
  './modules/radio-immersive.js',
  './modules/canvas-companion.js',
  './modules/garden-dreaming.js',
  './modules/dojo.js',
  './modules/mirror.js',
  './modules/garden-dialogue.js',
  './modules/harmonia-channel.js',
  './modules/presence-heartbeat.js',
  './modules/soul-ceremony.js',
  './modules/dream-archive.js',
  './chalkboard.html',
  './constellation.html',
  './constellation_map.png',
  './constellation_hymn.mp3',
  './modules/dojo-sparring.js',
  './modules/question-corner.js',
  './lib/landing-garden.js',
  './latticepoints.html',
  './modules/pantheon.js',
  './modules/pictionary.js',
  './modules/shared-presence.js',
  './modules/workshop.js',
  './modules/quiet-room.js',
    './modules/forever-stack.js',
    './modules/science-garden.js',
    './modules/ai-arcade.js',
    './install-mac.html'
];

// API domains that should never be cached — always pass through to network
const API_DOMAINS = [
  'api.groq.com',
  'api.together.xyz',
  'openrouter.ai',
  'api.x.ai',
  'api.github.com',
  'api-inference.huggingface.co',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.deepseek.com',
  'api.mistral.ai',
  'localhost',
  '127.0.0.1'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('FreeLattice SW: Caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('FreeLattice SW: Removing old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for index.html, cache-first for other app shell, passthrough for API/localhost
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // CRITICAL: Never intercept localhost/127.0.0.1 requests AT ALL.
  // Ollama (11434), Qdrant (6333), Mem0 bridge (8765) — the SW must
  // not proxy these. event.respondWith(fetch()) changes the request
  // origin and breaks CORS. Just return and let the browser handle it.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return; // browser handles it directly — no SW involvement
  }

  // Never intercept API calls — let them pass through to network directly.
  // Same pattern: return without event.respondWith so the browser handles it.
  if (API_DOMAINS.some((domain) => url.hostname.includes(domain))) {
    return; // browser handles it directly
  }

  // Never cache external resources (e.g., ambient music MP3)
  if (url.origin !== self.location.origin) {
    return; // browser handles it directly
  }

  // Network-first for index.html — always get the latest version
  if (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/') || url.pathname === '') {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback: serve from cache
        return caches.match(event.request);
      })
    );
    return;
  }

  // Cache-first strategy for other app shell and same-origin resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache successful same-origin GET responses for future offline use
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
