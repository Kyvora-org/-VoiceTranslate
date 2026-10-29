/**
 * sw.js - Service Worker para VoiceTranslate PWA
 * Gestiona el caché de la aplicación para carga instantánea y funcionamiento como PWA instalada.
 */

const CACHE_NAME = 'voicetranslate-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './assets/logo.png',
  './manifest.json',
  './js/app.js',
  './js/configLoader.js',
  './js/config.example.js',
  './js/speechRecognition.js',
  './js/speechSynthesis.js',
  './js/translation.js',
  './js/history.js',
  './js/ui.js'
];

// Instalación: pre-cacheo de recursos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activación: limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de peticiones
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Las peticiones a APIs externas de traducción siempre van directo a la red (no cachear)
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('mymemory.translated.net') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Estrategia Network-First con fallback a Caché para recursos locales
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback a index.html para navegación SPA
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
