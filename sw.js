// Radio Adamowo Service Worker - Professional Implementation
const CACHE_NAME = 'radio-adamowo-v2.0.0';
const OFFLINE_URL = '/professional-homepage.html';

const urlsToCache = [
  '/',
  '/professional-homepage.html',
  '/index.html',
  '/level2/indexx.html',
  '/style.css',
  '/script.js',
  '/modules/audio/player.js',
  '/modules/utils/helpers.js',
  '/modules/i18n/manager.js',
  '/playlist.json',
  '/lang/pl.json',
  '/lang/en.json',
  '/lang/nl.json',
  '/docs/beep.txt',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Special+Elite&display=swap',
  'https://cdn.jsdelivr.net/npm/hls.js@1.5.7/dist/hls.min.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache opened');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] All resources cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] All old caches deleted');
      return self.clients.claim();
    })
  );
});

// Enhanced fetch strategy: Network first for API, cache first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external requests except for allowed CDNs
  if (url.origin !== location.origin && 
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('cdn.tailwindcss.com') &&
      !url.hostname.includes('cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    // Try network first for HTML documents
    event.request.headers.get('accept')?.includes('text/html') ?
      networkFirstStrategy(event.request) :
      cacheFirstStrategy(event.request)
  );
});

// Network first strategy (for HTML)
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match(OFFLINE_URL);
  }
}

// Cache first strategy (for assets)
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed for:', request.url, error);
    throw error;
  }
}

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  if (event.tag === 'radio-adamowo-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundSync() {
  try {
    // Sync offline data when connection is restored
    console.log('[SW] Performing background sync...');
    
    // Example: sync user comments, preferences, etc.
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    
    // Process any queued requests
    for (const request of requests) {
      if (request.url.includes('/api/')) {
        console.log('[SW] Syncing API request:', request.url);
        // Handle API sync logic here
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Enhanced push notification support
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nowa wiadomość z Radio Adamowo',
      icon: 'https://public-frontend-cos.metadl.com/mgx/img/favicon.png',
      badge: 'https://public-frontend-cos.metadl.com/mgx/img/favicon.png',
      vibrate: [200, 100, 200],
      tag: 'radio-adamowo-notification',
      requireInteraction: false,
      actions: [
        {
          action: 'open',
          title: 'Otwórz',
          icon: 'https://public-frontend-cos.metadl.com/mgx/img/favicon.png'
        },
        {
          action: 'dismiss',
          title: 'Odrzuć',
          icon: 'https://public-frontend-cos.metadl.com/mgx/img/favicon.png'
        }
      ],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.id || 1,
        url: data.url || '/professional-homepage.html'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Radio Adamowo', options)
    );
  }
});

// Enhanced notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event.action);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/professional-homepage.html';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_RESPONSE',
      version: CACHE_NAME
    });
  }
});

// Handle errors
self.addEventListener('error', (event) => {
  console.error('[SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service Worker registered successfully');