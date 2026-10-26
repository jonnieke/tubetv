// ==============================================================================
// TubeTV Service Worker: Offline-First & Low-Bandwidth Caching
// Target: Safari iOS, Chrome Android, Edge, Desktop PWA
// ==============================================================================

const CACHE_VERSION = 'tubetv-v1.0.1';
const STATIC_CACHE = `tubetv-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `tubetv-images-${CACHE_VERSION}`;
const API_CACHE = `tubetv-api-${CACHE_VERSION}`;

// Pre-cached critical assets
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/favicon.ico',
];

// Install Event: Pre-cache core shell & offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old version caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, IMAGE_CACHE, API_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Intelligent routing strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests, backend APIs, and video media streams (HLS/video chunks buffered by players)
  if (request.method !== 'GET') return;
  if (request.destination === 'video' || request.destination === 'audio') return;
  if (url.pathname.match(/\.(ts|m4s|m3u8|mp4|webm)$/i)) return;
  if (url.hostname.includes('supabase.co')) return;

  // 2. Images (Thumbnails, Posters, Bunny CDN thumbs) -> Cache First, fall back to network
  if (
    request.destination === 'image' ||
    url.hostname.includes('b-cdn.net') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/)
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // If offline and image missing, return null or fallback
          return cached || new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // 3. Static Assets (Scripts, CSS, Fonts) -> Stale-While-Revalidate
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. HTML Navigation / SPA Page Requests -> Network First, fall back to cached index.html or offline.html
  if (request.mode === 'navigate' || url.pathname.startsWith('/watch/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cachedIndex = await cache.match('/index.html');
        if (cachedIndex) return cachedIndex;

        const cachedOffline = await cache.match('/offline.html');
        return cachedOffline || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // Default fallback (safely catch to prevent unhandled rejected promise errors)
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request).catch(() => new Response('', { status: 408 }));
    })
  );
});
