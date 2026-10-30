import { expect, test } from "@playwright/test";

test("reopens the app shell while offline", async ({ context, page }) => {
  await page.addInitScript(() => {
    // Seed caches before the worker installs, as another portfolio app might.
    window.caches.open("another-portfolio-app");
    window.caches.open("life-lanes-shell:/another-path/:v1");
  });
  await page.goto("./");
  await expect(page).toHaveURL(/\/LifeLanes\/$/);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/LifeLanes/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/LifeLanes/icon-192.png",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://georgemorden.github.io/LifeLanes/social-preview.jpg",
  );

  const serviceWorkerScope = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.scope;
  });
  expect(serviceWorkerScope).toMatch(/\/LifeLanes\/$/);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames).toContain("another-portfolio-app");
  expect(cacheNames).toContain("life-lanes-shell:/another-path/:v1");
  await context.setOffline(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Life Lanes" })).toBeVisible();

  await context.setOffline(false);
});

test("does not cache requests with query parameters", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const stored = await page.evaluate(async () => {
    await fetch("./icon.svg?private=test");
    return (await Promise.all((await caches.keys()).map(async (key) =>
      (await (await caches.open(key)).keys()).map((request) => request.url)
    ))).flat();
  });
  expect(stored.some((url) => url.includes("private="))).toBe(false);
});

test("loads the completion artwork from the Pages subpath", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Open demo board" }).click();
  await page
    .getByRole("button", { name: "Complete Finish portfolio case study" })
    .click();

  const artwork = page.locator(".completion-flight img");
  await expect(artwork).toHaveAttribute(
    "src",
    "/LifeLanes/assets/celebration-goat.png",
  );
  await expect
    .poll(() => artwork.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
});
