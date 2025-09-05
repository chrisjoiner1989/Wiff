const CACHE_NAME = "wiff-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/app.js",
  "/js/db.js",
  "/js/ui.js",
  "/js/team.js",
  "/js/game.js",
  "/assets/icon-192.svg",
  "/assets/icon-512.svg",
  "/assets/logo.png",
];

self.addEventListener("install", (evt) => {
  self.skipWaiting();
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS).catch((err) => {
        console.warn("Failed to cache some assets:", err);
        // Cache what we can, skip what fails
        return Promise.allSettled(
          ASSETS.map((asset) =>
            cache.add(asset).catch((e) => {
              console.warn(`Failed to cache ${asset}:`, e);
              return null;
            })
          )
        );
      })
    )
  );
});

self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((k) =>
            k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()
          )
        )
      )
  );
});

self.addEventListener("fetch", (evt) => {
  // Network first for HTML, otherwise cache-first
  const req = evt.request;
  if (
    req.mode === "navigate" ||
    (req.method === "GET" && req.headers.get("accept")?.includes("text/html"))
  ) {
    evt.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }

  evt.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((r) => {
          // Optionally put new fetches into cache
          return r;
        })
    )
  );
});
