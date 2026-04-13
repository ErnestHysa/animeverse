/**
 * Service Worker for PWA Support
 * Caches assets for offline access
 * Only active in production - disabled in development
 */

// Bump this version on each release to bust old caches
const CACHE_VERSION = "1";

const STATIC_CACHE = "animeverse-static-v" + CACHE_VERSION;
const DYNAMIC_CACHE = "animeverse-dynamic-v" + CACHE_VERSION;

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icons/icon.svg",
  "/favicon.ico",
];

// Patterns to skip - development files and Next.js internals
const SKIP_PATTERNS = [
  "/__next",
  "_next",
  "/_next",
  "%5B", // URL encoded [
  "%5D", // URL encoded ]
  "turbopack",
  "bb6de_", // Next.js dev build prefix
  "hmr-client",
  "react-dom",
  "react-server",
  "next-devtools",
  "swc_helpers",
  "@swc",
  "compiled",
  ".woff2", // Font files
  ".woff",
  ".ttf",
  ".eot",
];

// Check if URL should be skipped
function shouldSkipUrl(url) {
  const pathname = url.pathname;
  const search = url.search;
  const hash = url.hash;

  // Check all skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (
      pathname.includes(pattern) ||
      search.includes(pattern) ||
      hash.includes(pattern)
    ) {
      return true;
    }
  }

  return false;
}

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).catch((error) => {
      console.error("Service worker install failed:", error);
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

  // Skip development files and Next.js internals
  if (shouldSkipUrl(url)) {
    return;
  }

  // Skip API requests
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Skip external resources
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      // Fetch from network with error handling
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
        }).catch(() => {
          // Silently fail - cache errors shouldn't break the app
        });

        return response;
      }).catch(() => {
        // Network failed - return a basic offline response for HTML pages
        if (request.headers.get("accept")?.includes("text/html")) {
          const offlinePage = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline - AnimeVerse</title><style>body{background:#0a0a1a;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;}.container{text-align:center;padding:2rem;}h1{font-size:1.5rem;margin-bottom:0.5rem;}p{color:#94a3b8;}</style></head><body><div class="container"><h1>You're Offline</h1><p>Check your internet connection and try again.</p></div></body></html>`;
          return new Response(
            offlinePage,
            { headers: { "Content-Type": "text/html" } }
          );
        }
        throw new Error("Network request failed");
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
