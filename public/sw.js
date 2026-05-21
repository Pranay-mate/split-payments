/**
 * EasySplits service worker.
 *
 * Strategy:
 *   - HTML navigations: network-first, fall back to cached version,
 *     then "/" (so users at least see home if everything else fails)
 *   - Static assets / images: stale-while-revalidate (serve cached +
 *     background refetch, so the next visit gets fresh)
 *   - Skip non-GET, cross-origin, and Vercel internals (_next/data
 *     uses fresh JSON; we want network-first there too)
 *
 * APP_VERSION drives both cache-busting and the major-version
 * force-update check. Must stay in sync with APP_VERSION in
 * src/lib/app-version.ts (two constants because SW runs in a separate
 * JS context and can't import the TS file).
 *
 * Bump rules:
 *   - Minor (1.0 → 1.1): normal release, banner shows.
 *   - Major (1.x → 2.0): force release, modal blocks app until reload.
 */
const APP_VERSION = "3.0";
const RUNTIME_CACHE = `easysplits-runtime-v${APP_VERSION}`;

self.addEventListener("install", () => {
  // Don't auto-skipWaiting. We want the new SW to sit in 'waiting'
  // state so the page can detect it and show the "Update available"
  // banner — the user controls when to activate via a SKIP_WAITING
  // postMessage from the banner's Reload button. First-time installs
  // (no controller yet) skip waiting via the message handler below
  // immediately on `activate` setup, so first-time UX still feels fast.
});

self.addEventListener("message", (event) => {
  // Triggered by <SwUpdateBanner /> when the user accepts the update.
  // Sending SKIP_WAITING transitions this SW from 'waiting' to 'active'
  // and the page then reloads to pick up the new assets.
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  // Client asks "what version are you?" via MessageChannel — we reply
  // with our APP_VERSION so the page can compare majors and decide
  // whether to show the normal banner or the force-update modal.
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: APP_VERSION });
  }
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

// Background Sync API: when the OS reports network is back, we post a
// message to all open clients asking them to drain the offline queue.
// We don't replay the queue from inside the SW because tRPC + auth +
// superjson reconstruction is non-trivial here, and any open tab can
// do the work just as well. iOS Safari doesn't fire 'sync' events, so
// it falls back to the in-tab 'online' listener.
self.addEventListener("sync", (event) => {
  if (event.tag !== "easysplits-sync") return;
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        client.postMessage({ type: "EASYSPLITS_SYNC" });
      }
    })(),
  );
});

// Web Push handler — receives a JSON payload from the cron job and
// renders a notification. Tap forwards the user to the URL we passed,
// or /app/groups by default.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "EasySplits", body: event.data.text() };
  }
  const title = data.title || "EasySplits";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    data: { url: data.url || "/app/groups" },
    tag: data.tag || "easysplits-reminder",
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/groups";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab on the same origin if there is one.
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              // navigate not always available; the focus alone is fine.
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

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

  // Static assets / images: stale-while-revalidate.
  //
  // Serve from cache immediately (fast paint), AND fire the network
  // request in parallel — when it lands, the cache is updated so the
  // NEXT visit gets the fresh version. Removes the need to bump
  // CACHE_VERSION on every static-asset change just to evict stale
  // chunks. For hashed Next.js chunks the URL itself changes per build
  // so there's no cache collision — SWR just smooths out the rare
  // same-URL refresh (e.g. /icon.png, /manifest.webmanifest).
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const networkFetch = fetch(request)
        .then(async (networkRes) => {
          if (shouldCache(networkRes)) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        })
        .catch(() => null);
      if (cached) {
        // event.waitUntil keeps the SW alive long enough for the
        // background put() to land, without blocking the response.
        event.waitUntil(networkFetch);
        return cached;
      }
      const networkRes = await networkFetch;
      if (networkRes) return networkRes;
      return new Response("", { status: 504 });
    })(),
  );
});
