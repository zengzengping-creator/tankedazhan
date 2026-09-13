const CACHE_NAME = "tank-party-v6";
const CORE = [
  "./",
  "./index.html",
  "./style.css",
  "./app-icon.svg",
  "./game.js",
  "./island-system.js",
  "./island-games.js",
  "./island-life.js",
  "./party-island-hub.js",
  "./party-special-modes.js",
  "./task-rewards.js",
  "./battle-supplies.js",
  "./real-3d-engine.js",
  "./touch-controls.js",
  "./music.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(CORE.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then((response) => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
