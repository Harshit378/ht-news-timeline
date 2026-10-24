// Service Worker for News Timeline PWA
// Handles offline caching and background sync

const CACHE_NAME = 'news-timeline-v2';
const API_CACHE = 'news-timeline-api-v2';
const OFFLINE_PAGE = '/offline.html';

// cache.addAll is atomic: every URL here must exist in the static export (trailingSlash: true).
const ASSETS_TO_CACHE = [
  '/',
  '/search/',
  '/story/',
  '/topics/',
  '/bookmarks/',
  '/live/',
  '/settings/',
  '/manifest.json',
  '/icon-192x192.png',
];

// Install event: cache essential assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching essential assets');
      return cache.addAll(ASSETS_TO_CACHE).catch((error) => {
        console.warn('[ServiceWorker] Failed to cache some assets:', error);
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event: network-first strategy for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response && response.status === 200) {
            const clonedResponse = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached API response if network fails
          return caches.match(request).then((response) => {
            return response || createOfflineResponse('API unavailable offline');
          });
        })
    );
    return;
  }

  // Asset requests: cache-first, fallback to network
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request)
        .then((response) => {
          // Cache successful responses
          if (!response || response.status !== 200 || response.type === 'error') {
            return response;
          }
          const clonedResponse = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clonedResponse);
          });
          return response;
        })
        .catch(() => {
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE).then((response) => {
              return response || createOfflineResponse('Page unavailable offline');
            });
          }
          return createOfflineResponse('Resource unavailable');
        });
    })
  );
});

// Background sync: sync bookmarks when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(syncBookmarks());
  }
});

async function syncBookmarks() {
  try {
    const cache = await caches.open(API_CACHE);
    const response = await fetch('/api/bookmarks');
    if (response.ok) {
      await cache.put('/api/bookmarks', response);
      return response;
    }
  } catch (error) {
    console.error('[ServiceWorker] Bookmark sync failed:', error);
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

  event.waitUntil(
    self.registration.showNotification(data.title || 'News Timeline', options)
  );
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

// Helper: create offline response
function createOfflineResponse(message) {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Offline - News Timeline</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #0a0a0b;
            color: #f0ede8;
          }
          .container {
            text-align: center;
            padding: 20px;
          }
          h1 { margin: 0 0 10px 0; }
          p { margin: 0; opacity: 0.7; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📡 You're Offline</h1>
          <p>${message}</p>
          <p style="margin-top: 20px; font-size: 14px;">Check your connection and try again</p>
        </div>
      </body>
    </html>
    `,
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    }
  );
}
