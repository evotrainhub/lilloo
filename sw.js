// Lilloo Service Worker — v2
const CACHE_NAME = 'lilloo-v2';

// Fișierele core ale aplicației
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Resurse externe (Google Fonts + React CDN)
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&family=Cormorant+Garamond:wght@600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js'
];

// ─── INSTALL: cache toate fișierele core ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache core assets (obligatoriu)
      return cache.addAll(CORE_ASSETS)
        .then(() => {
          // Cache external assets (best-effort, nu blocăm install dacă eșuează)
          return Promise.allSettled(
            EXTERNAL_ASSETS.map(url =>
              fetch(url, { mode: 'cors' })
                .then(res => { if (res.ok) cache.put(url, res); })
                .catch(() => {}) // ignoră erorile de rețea
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE: șterge cache-urile vechi ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: strategii diferite per tip de resursă ───
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignoră request-uri non-GET și extensii browser
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Strategie: Cache First → Network Fallback
  // (pentru toate resursele aplicației)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          // Salvează în cache doar răspunsuri valide
          if (
            response &&
            response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors')
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: returnează index.html pentru navigare
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // Pentru alte resurse, returnează eroare silențioasă
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
