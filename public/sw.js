// Via Carraria — Offline Progressive Web App Service Worker
const CACHE_NAME = 'viacarraria-shell-v1';

// Core assets precached during service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
];

// Patterns that must bypass the service worker cache (APIs, WebSockets)
const BYPASS_PREFIXES = ['/api/', '/socket.io/'];

// Install event: Precache core assets & activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Precache failed:', err);
      }),
  );
});

// Activate event: Clean up old caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Fetch event: Apply appropriate caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle HTTP/HTTPS GET requests from same-origin or static CDNs
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Bypass API calls, Socket.io, and backend endpoints
  if (BYPASS_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return;
  }

  // 1. Navigation requests (HTML document loads)
  // Network-first with cache fallback for offline readiness
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match('/index.html') || caches.match('/');
          });
        }),
    );
    return;
  }

  // 2. Static assets: /assets/*, KaTeX webfonts (.woff2, .woff, .ttf), and image icons
  // Strategy: Stale-While-Revalidate (serve fast from cache, update in background)
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.ttf') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      }),
    );
    return;
  }

  // Default fallback: Network first, cache as backup
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Message listener for skipWaiting trigger
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
