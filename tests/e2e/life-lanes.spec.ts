import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test("loads the main board and tabs", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Life Lanes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open My Life Lanes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Brain Dump" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Achievements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "To Do" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parked" })).toBeVisible();
});

test("captures a brain dump into triage", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Brain Dump note").fill("Book a quiet money reset");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();

  await expect(page.getByText("Book a quiet money reset")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort" })).toBeVisible();
});

test("triages a note into a Life Lane", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Brain Dump note").fill("Plan a family lunch");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Plan a family lunch" }).getByRole("button", { name: "Sort" }).click();
  await page.getByLabel("Triage Life Lane").selectOption({ label: "Relationships" });
  await page.getByRole("button", { name: "Place on board" }).click();
  await page.getByRole("button", { name: "Open My Life Lanes" }).click();

  await expect(page.getByRole("button", { name: "Open Plan a family lunch" })).toBeVisible();
});

test("moves completed items into Achievements", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose board").selectOption("demo");

  await page.getByRole("button", { name: "Complete Project management certification" }).click();
  await page.getByRole("button", { name: "Open Achievements" }).click();

  await expect(page.getByRole("button", { name: "Open Project management certification" })).toBeVisible();
});

test("keeps personal notes after refresh", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Brain Dump note").fill("Keep this after refresh");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();

  await page.reload();
  await page.getByRole("button", { name: "Open Brain Dump" }).click();

  await expect(page.getByText("Keep this after refresh")).toBeVisible();
});
