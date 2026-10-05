/* Ventura Luz e Efeitos — service worker
 *
 * Bump VERSION whenever the shell (index.html / public assets) changes so the
 * old caches are dropped on activate. Hashed build assets under /assets are
 * content-addressed, so they are safe to cache forever and don't need a bump.
 */

const VERSION = 'ventura-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const FONT_CACHE = `${VERSION}-fonts`;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/logo.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll is atomic: a single 404 would reject and abort the install, so
      // cache entries individually and tolerate misses.
      .then((cache) => Promise.all(SHELL_URLS.map((url) => cache.add(url).catch(() => {}))))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE && key !== FONT_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

const isCacheable = (response) =>
  Boolean(response) && (response.ok || response.type === 'opaque');

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw new Error('offline');
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Never touch the API: it is authenticated and holds mutable financial data.
  if (url.pathname.startsWith('/api')) return;

  // SPA navigations — network-first so a fresh deploy is picked up immediately,
  // falling back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(new Request('/index.html', { cache: 'reload' }), SHELL_CACHE, '/index.html').catch(
        () =>
          new Response(
            '<!doctype html><meta charset="utf-8"><title>Offline</title>' +
              '<body style="background:#000;color:#fff;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0;text-align:center">' +
              '<div><h1 style="color:#CDFF00">Sem conex&atilde;o</h1>' +
              '<p style="color:#A0A0A0">Conecte-se &agrave; internet e recarregue.</p></div>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
          )
      )
    );
    return;
  }

  // Google Fonts — stale-while-revalidate keeps text rendering stable offline.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  if (!sameOrigin) return;

  // Hashed build output is immutable; icons/logo are small and stable.
  if (url.pathname.startsWith('/assets/') || /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      cacheFirst(request, ASSET_CACHE).catch(
        () => new Response('', { status: 504, statusText: 'asset unavailable' })
      )
    );
  }
});
