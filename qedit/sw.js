const CACHE_NAME = 'qatt-editor-v2'; // Ändere dies bei jedem Code-Update (v2, v3, ...)
const ASSETS = [
  'index.html',
  'manifest.json',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'qatt-dc/js/renderer.js?1'
];

self.addEventListener('install', event => {
  // Erzwingt, dass der neue Service Worker sofort aktiv wird
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  // Löscht alte Caches beim Aktivieren der neuen Version
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
