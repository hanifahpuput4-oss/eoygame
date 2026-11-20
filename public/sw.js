const CACHE_NAME = 'llyssmart-pwa-v2';
const PRECACHE_ASSETS = [
  '/icons/icon-192.png',
  '/icons/maskable-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // HANYA layani file ikon statis dari cache; JANGAN intercept request API (/api/*), halaman, atau Next.js (_next/*)
  if (!PRECACHE_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)),
  );
});
