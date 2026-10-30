export function registerAppServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (import.meta.env.DEV) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations
        .filter((registration) => registration.active?.scriptURL === new URL(`${import.meta.env.BASE_URL}sw.js`, location.href).href)
        .forEach((registration) => registration.unregister()))
      .catch(() => {
        // Development should never depend on the offline shell.
      });
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {
        // The app remains fully usable without offline shell caching.
      });
  });
}
