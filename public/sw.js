/**
 * Service Worker for PWA Support
 * Caches assets for offline access
 */

const CACHE_NAME = "animeverse-v1";
const STATIC_CACHE = "animeverse-static-v1";
const DYNAMIC_CACHE = "animeverse-dynamic-v1";

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API requests and external resources
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1" &&
    !url.hostname.endsWith(".vercel.app") &&
    !url.hostname.endsWith(".netlify.app")
  ) {
    return;
  }

  // Skip Next.js HMR requests
  if (url.pathname.startsWith("/__next") || url.pathname.includes("_next")) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Return cached version
        return cached;
      }

      // Otherwise, fetch from network
      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        // Cache the response
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Skip waiting for update
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
