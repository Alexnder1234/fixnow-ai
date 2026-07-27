// v2: cambia la estrategia de "cache primero" a "red primero" para el
// shell de la app (html/css/js). Con "cache primero" cualquier cambio
// que subieras al servidor se quedaba invisible para quien ya habia
// visitado la app antes, porque el navegador seguia sirviendo la copia
// vieja guardada. Con "red primero" siempre intenta traer lo mas
// reciente, y solo usa la copia guardada si no hay conexion.
const CACHE_NAME = 'fixnow-ai-v2';
const ASSETS_ESTATICOS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/api.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_ESTATICOS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Estrategia: la API nunca se cachea. El resto (html/css/js/iconos)
// usa "red primero, cache como respaldo sin internet".
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    return; // nunca cachear llamadas a la API, siempre deben ir a la red
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copia = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
