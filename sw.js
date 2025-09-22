const CACHE_NAME = 'radio-adamowo-v1.1';
const STATIC_CACHE = 'radio-adamowo-static-v1.1';
const DYNAMIC_CACHE = 'radio-adamowo-dynamic-v1.1';

// Static assets to cache immediately
const staticUrlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js',
  'https://fonts.googleapis.com/css2?family=Special+Elite&display=swap'
];

// Dynamic content that can be cached on demand
const dynamicUrlPatterns = [
  /^https:\/\/.*\.(mp3|mp4|wav|webm)$/,
  /^\/public\/.*\.(png|jpg|jpeg|webp|svg)$/,
  /^\/playlist\.json$/,
  /^\/public\/data\/.*\.json$/
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(staticUrlsToCache);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle static assets
  if (staticUrlsToCache.includes(request.url) || request.url.includes('.js') || request.url.includes('.css')) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
    );
    return;
  }

  // Handle dynamic content (images, audio, etc.)
  const isDynamic = dynamicUrlPatterns.some(pattern => pattern.test(request.url));
  if (isDynamic) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.match(request)
            .then(response => {
              if (response) {
                return response;
              }
              return fetch(request)
                .then(networkResponse => {
                  // Cache successful responses
                  if (networkResponse.ok) {
                    cache.put(request, networkResponse.clone());
                  }
                  return networkResponse;
                })
                .catch(() => {
                  // Return offline fallback if available
                  if (request.destination === 'image') {
                    return new Response('<svg><!-- Offline fallback --></svg>', {
                      headers: { 'Content-Type': 'image/svg+xml' }
                    });
                  }
                  throw new Error('Network request failed and no cache available');
                });
            });
        })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old cache versions
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Background sync triggered');
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'https://public-frontend-cos.metadl.com/mgx/img/favicon.png',
      badge: 'https://public-frontend-cos.metadl.com/mgx/img/favicon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});