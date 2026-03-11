/**
 * MarketMind Service Worker
 * - Cache-first for static assets (JS, CSS, fonts, images)
 * - Network-first with offline fallback for API data
 * - Caches most recent dashboard data for instant offline loading
 */

const CACHE_NAME = "marketmind-v2.0";
const DATA_CACHE_NAME = "marketmind-data-v2.0";

// Static assets to precache on install
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
];

// API endpoints to cache for offline access
const CACHEABLE_API_PATTERNS = [
  "/api/trpc/market.quotes",
  "/api/trpc/market.narratives",
  "/api/trpc/market.predictions",
  "/api/trpc/market.experiments",
  "/api/trpc/market.modelPerformance",
  "/api/trpc/market.dataSources",
];

// Install: precache core shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: strategy depends on request type
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip WebSocket and OAuth requests
  if (url.pathname.startsWith("/api/oauth")) return;
  if (url.protocol === "ws:" || url.protocol === "wss:") return;

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith("/api/trpc/")) {
    const isCacheable = CACHEABLE_API_PATTERNS.some((p) => url.pathname.includes(p));
    if (isCacheable) {
      event.respondWith(networkFirstWithCache(event.request));
    }
    return;
  }

  // Google Fonts: cache-first (long-lived)
  if (url.hostname.includes("fonts.googleapis.com") || url.hostname.includes("fonts.gstatic.com")) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Static assets (JS, CSS, images): cache-first
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // HTML navigation: network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(event.request));
    return;
  }
});

// ─── Strategies ───

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({
        result: { data: { json: null } },
        error: { message: "You are offline. Showing cached data." },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    // Return cached index.html for SPA routing
    const indexCached = await caches.match("/");
    if (indexCached) return indexCached;

    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MarketMind — Offline</title><style>body{background:#0a0a1a;color:#e0e0e0;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}.c{max-width:400px;padding:2rem}h1{font-size:1.5rem;margin-bottom:1rem;color:#8cdcff}p{color:#888;line-height:1.6}</style></head><body><div class="c"><h1>MarketMind is Offline</h1><p>You appear to be offline. Please check your internet connection and try again.</p><button onclick="location.reload()" style="margin-top:1rem;padding:0.75rem 2rem;background:#3b82f6;color:white;border:none;border-radius:0.5rem;cursor:pointer;font-size:0.9rem">Retry</button></div></body></html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}

// ─── Helpers ───

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?.*)?$/.test(pathname);
}

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
