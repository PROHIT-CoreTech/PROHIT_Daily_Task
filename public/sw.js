// Minimal hand-written service worker (NFR §7: cache the current task list
// for basic offline viewing). No precache list — Next.js's hashed build
// output makes a static manifest fragile to maintain; everything here is
// populated by runtime caching as the user actually navigates.
const RUNTIME_CACHE = "prohit-runtime-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== RUNTIME_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // never cache mutating requests

  const url = new URL(request.url);
  const isStaticAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
  const isApiRead = url.pathname.startsWith("/api/v1/");

  if (isStaticAsset) {
    // Hashed filenames never change content, so cache-first is safe.
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  if (isApiRead) {
    // Network-first: prefer live data, fall back to the last-seen response
    // (e.g. My Day's task list) when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
