const APP_BASE = new URL("./", self.location.href);
const CACHE_PREFIX = `life-lanes-shell:${APP_BASE.pathname}:`;
const CACHE_NAME = `${CACHE_PREFIX}v7`;
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
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const response = await fetch(APP_ROOT, { cache: "reload" });
      if (!response.ok) throw new Error("The app shell could not be downloaded");
      const html = await response.clone().text();
      const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))["']/g)]
        .map((match) => new URL(match[1], APP_ROOT))
        .filter((url) => url.origin === APP_BASE.origin && url.pathname.startsWith(`${APP_BASE.pathname}assets/`));
      await cache.addAll([...APP_SHELL.filter((url) => url !== APP_ROOT && url !== appUrl("index.html")), ...assets.map(String)]);
      await cache.put(APP_ROOT, response.clone());
      await cache.put(appUrl("index.html"), response);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) =>
        key !== CACHE_NAME && (key.startsWith(CACHE_PREFIX) || /^life-lanes-shell-v\d+$/.test(key))
      ).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith(APP_BASE.pathname)) {
    return;
  }

  const relativePath = requestUrl.pathname.slice(APP_BASE.pathname.length);

  if (
    relativePath.startsWith("@vite") ||
    relativePath.startsWith("src/") ||
    relativePath.includes("__vite") || requestUrl.search
  ) {
    return;
  }

  if (event.request.mode === "navigate" && (relativePath === "" || relativePath === "index.html")) {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(APP_ROOT)) ?? cache.match(appUrl("index.html"));
      }),
    );
    return;
  }

  const isShellAsset = APP_SHELL.includes(requestUrl.href) || relativePath.startsWith("assets/");
  if (!isShellAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // These are public, same-origin static assets. Module requests can add an
      // Origin header that was absent during precaching (Vary: Origin).
      const cached = await cache.match(event.request, { ignoreVary: true });
      if (cached) {
        return cached;
      }

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        event.waitUntil(cache.put(event.request, response.clone()).catch(() => {}));
        return response;
      });
    }),
  );
});
