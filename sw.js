// FreeLattice Service Worker — Offline Mode
// Cache-first for app shell, network-first for API calls
// API calls are never cached

const CACHE_NAME = 'freelattice-v2.4';

const APP_SHELL = [
  './',
  './index.html'
];

// API domains that should never be cached — always pass through to network
const API_DOMAINS = [
  'api.groq.com',
  'api.together.xyz',
  'openrouter.ai',
  'api.x.ai',
  'api.github.com',
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

// Fetch: cache-first for app shell, network-only for API calls
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — always pass through to network
  if (API_DOMAINS.some((domain) => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Never cache external resources (e.g., ambient music MP3)
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first strategy for app shell and same-origin resources
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
