// ─── Tube TV Service Worker ───────────────────────────────────────────────────
// Strategy:
//   • App shell (HTML)         → Network-first, fallback to cache
//   • Hashed JS/CSS/fonts      → Cache-first (content-hash = safe forever)
//   • Images                   → Stale-while-revalidate (40 max)
//   • Supabase / Bunny API     → Network-only (never cache auth'd requests)
//   • Push notifications       → showNotification + click-to-open

const SHELL_CACHE   = 'tube-tv-shell-v1';
const STATIC_CACHE  = 'tube-tv-static-v1';
const IMAGE_CACHE   = 'tube-tv-images-v1';
const MAX_IMAGES    = 40;

const KNOWN_CACHES  = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE];

// ─── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(['/', '/index.html'])
    ).then(() => self.skipWaiting())
  );
});

// ─── Activate: delete stale caches ───────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !KNOWN_CACHES.includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache  = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      // Trim to MAX_IMAGES
      const keys = await cache.keys();
      if (keys.length > MAX_IMAGES) {
        await cache.delete(keys[0]);
      }
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ─── Fetch routing ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept GET requests
  if (request.method !== 'GET') return;

  // Never intercept Supabase, Bunny, or external APIs — always network
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('b-cdn.net') ||
    url.hostname.includes('bunnycdn.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('aistudiocdn.com')
  ) {
    return;
  }

  // Hashed static assets (JS, CSS, woff2) → cache-first
  if (/\.(js|css|woff2?)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Images → stale-while-revalidate
  if (/\.(png|jpe?g|svg|gif|webp|ico)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // SPA navigation → network-first, fallback to cached /index.html
  if (request.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, '/index.html'));
    return;
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Tube TV', {
      body:    data.body  || 'Something new is happening on Tube TV.',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-192.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
