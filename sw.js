// Crochet by Pleun — Service Worker
// Versie wordt automatisch bijgewerkt bij nieuwe deploy.

const CACHE_VERSION = '3.5.3';
const CACHE_NAME = `crochet-v${CACHE_VERSION}`;

const PRECACHE = [
  '/',
  '/index.html',
  '/galerij.html',
  '/eerder.html',
  '/product.html',
  '/over.html',
  '/bestellen.html',
  '/reviews.html',
  '/admin/',
  '/admin/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/js/cart.js',
  '/js/postcode.js',
  '/js/sw-register.js',
  '/js/tracker.js',
  '/js/modals.js',
  '/data/items.json',
  '/data/reviews.json',
  '/manifest.json',
  '/img/branding/app-icon.png',
  '/img/branding/banner.png',
  '/img/branding/hoofdlogo.png',
  '/img/branding/patroon.png'
];

// ===== Install: precache alle assets =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ===== Activate: ruim oude caches op =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        // Vertel alle open tabbladen dat er een nieuwe versie is
        self.clients.matchAll({ type: 'window' }).then(clients => {
          clients.forEach(client => client.postMessage({
            type: 'NEW_VERSION',
            version: CACHE_VERSION
          }));
        });
      })
  );
});

// ===== Fetch: network-first voor JSON/HTML, cache-first voor rest =====
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Sla externe requests over (fonts, analytics, wa.me)
  if (url.origin !== self.location.origin) return;

  // JSON, HTML, config.js en tracker.js: network-first (altijd verse versie)
  if (url.pathname.endsWith('.json') || url.pathname.endsWith('.html')
      || url.pathname === '/'
      || url.pathname === '/js/config.js'
      || url.pathname === '/js/tracker.js') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Overige assets (CSS, JS, afbeeldingen): cache-first met bg-update
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response('Offline — geen verbinding 🧶', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Stille achtergrond-update
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(CACHE_NAME).then(cache => cache.put(request, response));
      }
    }).catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

// ===== Message handler =====
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});
