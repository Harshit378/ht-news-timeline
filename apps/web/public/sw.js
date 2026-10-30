// Service Worker for News Timeline PWA (ADR-006): offline reading + background bookmark sync.
// Registered as /sw.js?api=<API origin> by PWAInitializer; only that origin's /api/* is treated as API.

const VERSION = 'v3';
const STATIC_CACHE = `ht-static-${VERSION}`;
const PAGES_CACHE = `ht-pages-${VERSION}`;
const API_CACHE = `ht-api-${VERSION}`;
// Written by the page (app/lib/bookmark-sync.ts), read by the `sync` handler. Not versioned: it holds user data.
const OUTBOX_CACHE = 'ht-outbox';
const OUTBOX_PATH = '/__outbox/bookmarks';
const KEEP = [STATIC_CACHE, PAGES_CACHE, API_CACHE, OUTBOX_CACHE];

const OFFLINE_PAGE = '/offline.html';
const API_TIMEOUT_MS = 6000;
const API_CACHE_MAX = 200;

const API_ORIGIN = (() => {
  try {
    const api = new URL(self.location.href).searchParams.get('api');
    return api ? new URL(api).origin : self.location.origin;
  } catch {
    return self.location.origin;
  }
})();

// Read-only payloads worth having offline. Bookmarks (user data), health and feed config never are.
const CACHEABLE_API = /^\/api\/(feed|articles|timeline|topics|trending|breaking|summaries|events)(\/|$)/;

// cache.addAll is atomic: every URL here must exist in the static export (trailingSlash: true).
const PRECACHE_PAGES = ['/', '/search/', '/story/', '/topics/', '/bookmarks/', '/live/', '/settings/', OFFLINE_PAGE];
const PRECACHE_STATIC = ['/manifest.json', '/icon-192x192.png', '/icon-512x512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(PAGES_CACHE).then((c) => c.addAll(PRECACHE_PAGES)),
      caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_STATIC)),
    ]).catch((error) => console.warn('[ServiceWorker] Precache incomplete:', error))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => !KEEP.includes(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === API_ORIGIN && url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API.test(url.pathname)) event.respondWith(networkFirstApi(request));
    return; // other API calls go straight to the network, never cached
  }

  if (url.origin !== self.location.origin) return; // cross-origin images, fonts CDNs, etc.

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  // Content-hashed build output and fixed assets never change under the same URL.
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:woff2?|png|svg|ico|webmanifest)$/.test(url.pathname) ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

/** Pages: always try the network so a deploy shows up at once; offline → cached copy → offline page. */
async function networkFirstPage(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) void cache.put(request, response.clone());
    return response;
  } catch {
    return (
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_PAGE)) ||
      new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) void cache.put(request, response.clone());
  return response;
}

/** API: network first (with a timeout for flaky mobile networks), then the last good copy. */
async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await withTimeout(fetch(request), API_TIMEOUT_MS);
    if (response.status === 200) {
      await cache.put(request, response.clone());
      void trimCache(cache, API_CACHE_MAX);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error; // let the app see a network error and use its own fallback
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/** Cache keys come back in insertion order; re-put moves an entry to the end, so this drops the oldest. */
async function trimCache(cache, max) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)));
}

// Background Sync (Chromium): send the queued bookmark set even if the page has been closed.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookmarks') event.waitUntil(syncBookmarks());
});

async function syncBookmarks() {
  const cache = await caches.open(OUTBOX_CACHE);
  const entry = await cache.match(OUTBOX_PATH);
  if (!entry) return;
  const { url, body } = await entry.json();
  if (new URL(url).origin !== API_ORIGIN) return; // only ever talk to our own API
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status >= 500) throw new Error(`bookmark sync failed: ${response.status}`); // browser retries
  // Only remove what we sent: the page may have queued a newer set meanwhile.
  const current = await cache.match(OUTBOX_PATH);
  if (current && JSON.stringify((await current.json()).body) === JSON.stringify(body)) {
    await cache.delete(OUTBOX_PATH);
  }
  if (response.ok) {
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) client.postMessage({ type: 'bookmarks-synced', articleIds: body.articleIds });
  }
}

// Push notifications: handle incoming push events
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'News Timeline Update',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'news-timeline',
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(data.title || 'News Timeline', options));
});

// Notification click: open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
