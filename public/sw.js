const CACHE_NAME = "life-lanes-shell-v6";
const APP_BASE = new URL("./", self.location.href);
const appUrl = (path = "") => new URL(path, APP_BASE).toString();
const APP_ROOT = appUrl();
const APP_SHELL = [
  APP_ROOT,
  appUrl("index.html"),
  appUrl("manifest.webmanifest"),
  appUrl("icon.svg"),
  appUrl("icon-192.png"),
  appUrl("icon-512.png"),
  appUrl("icon-512-maskable.png"),
  appUrl("assets/celebration-goat.png"),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const relativePath = requestUrl.pathname.startsWith(APP_BASE.pathname)
    ? requestUrl.pathname.slice(APP_BASE.pathname.length)
    : requestUrl.pathname;

  if (
    relativePath.startsWith("@vite") ||
    relativePath.startsWith("src/") ||
    relativePath.includes("__vite")
  ) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        return (await caches.match(APP_ROOT)) ?? caches.match(appUrl("index.html"));
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return response;
      });
    }),
  );
});
