/**
 * EasySplits service worker.
 *
 * Strategy:
 *   - HTML navigations: network-first, fall back to cached version, then "/"
 *     (lets users at least see the home page if everything else fails)
 *   - Static assets / images: cache-first
 *   - Skip non-GET, cross-origin, and Vercel internals (_next/data uses
 *     fresh JSON; we want network-first there too)
 *
 * Bumps CACHE_VERSION on every meaningful SW change to force old caches
 * to be evicted on next activation.
 */

const CACHE_VERSION = "v1";
const RUNTIME_CACHE = `easysplits-runtime-${CACHE_VERSION}`;

self.addEventListener("install", () => {
  // Activate immediately on first install — no need to wait for old tabs.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isNavigation(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").includes("text/html"))
  );
}

function shouldCache(response) {
  return (
    response &&
    response.status === 200 &&
    response.type === "basic" // skip opaque cross-origin
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Skip Vercel build/insights endpoints and our analytics beacons.
  if (url.pathname.startsWith("/_vercel/") || url.pathname.startsWith("/api/")) {
    return;
  }

  if (isNavigation(request)) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(request);
          if (shouldCache(networkRes)) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          if (fallback) return fallback;
          return new Response(
            "<h1>Offline</h1><p>You are offline and this page hasn't been cached yet. Visit it once with internet to make it available offline.</p>",
            { headers: { "Content-Type": "text/html" } },
          );
        }
      })(),
    );
    return;
  }

  // Static assets / images: cache-first.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const networkRes = await fetch(request);
        if (shouldCache(networkRes)) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, networkRes.clone());
        }
        return networkRes;
      } catch {
        return new Response("", { status: 504 });
      }
    })(),
  );
});
