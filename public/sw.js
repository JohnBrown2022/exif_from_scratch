/* eslint-disable no-restricted-globals */

const CACHE_NAME = 'exif-watermark-cache-v1';
const CORE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-192.png',
  '/pwa-maskable-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
      } catch {
        // Ignore precache errors (e.g. missing favicon during dev).
      }
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function isSameOriginGet(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  return url.origin === self.location.origin;
}

function shouldBypassCache(url) {
  return url.pathname === '/sw.js';
}

async function cachePut(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
}

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    cachePut(request, response);
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match('/');
    if (shell) return shell;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    cachePut(request, response);
    return response;
  } catch {
    if (cached) return cached;
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!isSameOriginGet(request)) return;
  const url = new URL(request.url);
  if (shouldBypassCache(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request));
});
