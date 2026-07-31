import { expect, test } from "@playwright/test";

test("reopens the app shell while offline", async ({ context, page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Life Lanes" })).toBeVisible();

  await context.setOffline(false);
});
