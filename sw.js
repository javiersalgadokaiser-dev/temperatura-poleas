// Service worker: guarda la app en caché para que funcione sin conexión.
// IMPORTANTE: subir VERSION cada vez que se publique un cambio, para que los teléfonos se actualicen.
const VERSION = 'v1.1.1';
const CACHE = `temperatura-poleas-${VERSION}`;

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/ui/estilos.css',
  'src/ui/app.js',
  'src/ui/estado.js',
  'src/ui/utilidades.js',
  'src/ui/componentes.js',
  'src/ui/vista-inicio.js',
  'src/ui/vista-registro.js',
  'src/ui/vista-historial.js',
  'src/ui/vista-ajustes.js',
  'src/data/db.js',
  'src/data/estaciones.js',
  'src/data/nube.js',
  'src/logica/alertas.js',
  'src/logica/exportar-excel.js',
  'src/logica/nube.js',
  'vendor/exceljs.min.js',
  'plantilla/registro-temperatura.xlsx',
  'icons/icono.svg',
  'icons/icono-192.png',
  'icons/icono-512.png',
  'icons/icono-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('temperatura-poleas-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la caché (rápido y sin conexión); si no está, se pide a la red.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((enCache) => {
      if (enCache) return enCache;
      return fetch(request).catch(() => {
        if (request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    }),
  );
});
