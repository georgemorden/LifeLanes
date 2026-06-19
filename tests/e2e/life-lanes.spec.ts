import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("loads the main board and tabs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Life Lanes" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open My Life Lanes/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Brain Dump/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open Achievements/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doing" })).toBeVisible();
});

test("captures a brain dump into triage", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: /Open Brain Dump/i }).click();
  await page.getByLabel("Brain Dump note").fill("Book a quiet money reset");
  await page.getByRole("button", { name: "Capture" }).click();

  await expect(page.getByText("Book a quiet money reset")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort" })).toBeVisible();
});
