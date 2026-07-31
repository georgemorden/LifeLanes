import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const testSessionKey = "life-lanes-e2e-session";
    if (!window.sessionStorage.getItem(testSessionKey)) {
      window.localStorage.clear();
      window.sessionStorage.setItem(testSessionKey, "ready");
    }
  });
});

test("loads the main board and tabs", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;

  await expect(page.getByRole("heading", { name: "Life Lanes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open My Life Lanes" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Workspace" })
      .getByRole("button", { name: "Open Brain Dump" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Achievements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doing" })).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole("button", { name: "To Do 0" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Parked 0" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "To Do" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Parked" })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Add Life Lane" })).toBeVisible();
});

test("reorders Life Lanes from the board and keeps the order", async ({ page }) => {
  await page.goto("/");

  const lifestyleHandle = page.getByRole("button", { name: "Reorder Lifestyle" });
  await lifestyleHandle.focus();
  await lifestyleHandle.press("Space");
  await lifestyleHandle.press("ArrowDown");
  await lifestyleHandle.press("Space");

  await expect(page.getByRole("button", { name: "Reorder Career" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAccessibleName(
    "Reorder Career",
  );

  await page.reload();
  await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAccessibleName(
    "Reorder Career",
  );
});

test("reorders Life Lanes from Customize", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Customize board" }).click();

  const lifestyleHandle = page
    .getByRole("dialog", { name: "Customize Life Lanes" })
    .getByRole("button", { name: "Reorder Lifestyle" });
  await lifestyleHandle.focus();
  await lifestyleHandle.press("Space");
  await lifestyleHandle.press("ArrowDown");
  await lifestyleHandle.press("Space");

  const dialogHandles = page
    .getByRole("dialog", { name: "Customize Life Lanes" })
    .getByRole("button", { name: /^Reorder / });
  await expect(dialogHandles.first()).toHaveAccessibleName("Reorder Career");
});

test("adds an editable Brain Dump starter", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  await page.getByRole("button", { name: "Untangle a problem" }).click();

  await expect(page.getByLabel("Brain Dump note")).toHaveValue(
    /What's the problem\?/,
  );
});

test("captures a brain dump into triage", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  await page.getByLabel("Brain Dump note").fill("Book a quiet money reset");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();

  await expect(page.getByText("Book a quiet money reset")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sort" })).toBeVisible();
});

test("triages a note into a Life Lane", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  await page.getByLabel("Brain Dump note").fill("Plan a family lunch");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();
  await page.getByRole("article").filter({ hasText: "Plan a family lunch" }).getByRole("button", { name: "Sort" }).click();
  await page.getByLabel("Triage Life Lane").selectOption({ label: "Relationships" });
  await page.getByRole("button", { name: "Place on board" }).click();
  await page.getByRole("button", { name: "Open My Life Lanes" }).click();
  if ((page.viewportSize()?.width ?? 1280) <= 720) {
    await page.getByRole("button", { name: "To Do 1" }).click();
  }

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
  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  await page.getByLabel("Brain Dump note").fill("Keep this after refresh");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();
  await expect(page.getByText("Keep this after refresh")).toBeVisible();

  await page.reload();
  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();

  await expect(page.getByText("Keep this after refresh")).toBeVisible();
});
