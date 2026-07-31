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
    await expect(page.getByRole("tab", { name: "To Do 0" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Parked 0" })).toBeVisible();
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
  await page.waitForTimeout(60);
  await lifestyleHandle.press("ArrowDown");
  await page.waitForTimeout(60);
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
  await page.waitForTimeout(60);
  await lifestyleHandle.press("ArrowDown");
  await page.waitForTimeout(60);
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
    await page.getByRole("tab", { name: "To Do 1" }).click();
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

test("keeps a custom state named Completed editable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Customize board" }).click();
  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  await dialog.getByLabel("New state").fill("Completed");
  await dialog.getByRole("button", { name: "Add state" }).click();

  await expect(dialog.getByLabel("Rename Completed")).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Delete Completed" })).toBeVisible();
  await expect(dialog.getByText("System")).toHaveCount(1);
});

test("previews and safely normalizes an imported backup", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Customize board" }).click();
  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  const stamp = new Date().toISOString();
  const backup = {
    schemaVersion: 2,
    preset: "draft",
    defaultLaneVersion: 3,
    updatedAt: stamp,
    columns: [
      { id: "doing", title: "Doing", kind: "active", createdAt: stamp },
      { id: "done", title: "Achievements", kind: "achievement", createdAt: stamp },
    ],
    lanes: [
      { id: "lane-home", name: "Home", color: "mint", icon: "home", createdAt: stamp },
    ],
    drafts: [],
    items: [
      {
        id: "item-imported",
        title: "Imported safely",
        note: "Invalid dates are removed rather than breaking the board.",
        column: "doing",
        laneId: "lane-home",
        priority: "medium",
        startDate: "not-a-date",
        endDate: "2026-99-99",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
  };

  await dialog.locator('input[type="file"]').evaluate(
    (input, contents) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([contents], "life-lanes-backup.json", {
          type: "application/json",
        }),
      );
      Object.defineProperty(input, "files", { value: transfer.files });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    JSON.stringify(backup),
  );

  await expect(dialog.getByText("Ready to import")).toBeVisible();
  await expect(dialog.getByText("1 item")).toBeVisible();
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(page.getByRole("button", { name: "Open Imported safely" })).toBeVisible();
});

test("warns when browser storage cannot save", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Brain Dump note").fill("Keep this visible in memory");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();

  await expect(page.getByRole("alert")).toContainText("could not save");
  await expect(page.getByRole("button", { name: "Download backup" })).toBeVisible();
});

test("warns when browser storage cannot be read", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key: string) {
      if (this === window.localStorage && key === "life-lanes-two-panel-v1") {
        throw new DOMException("Storage blocked", "SecurityError");
      }
      return originalGetItem.call(this, key);
    };
  });
  await page.goto("/");

  await expect(page.getByRole("alert")).toContainText("would not allow Life Lanes to read saved data");
  await expect(page.getByRole("button", { name: "Download backup" })).toBeVisible();
});

test("offers a recovery download for corrupted saved data", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("life-lanes-two-panel-v1", "{broken-json"));
  await page.reload();

  await expect(page.getByRole("alert")).toContainText("could not be opened");
  await expect(page.getByRole("button", { name: "Download backup" })).toBeVisible();
});

test("filters the board without changing its structure", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose board").selectOption("demo");
  await page.getByPlaceholder("Search items").fill("Holiday fund");

  await expect(page.getByRole("button", { name: "Open Holiday fund" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Project management certification" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("button", { name: "Open Project management certification" })).toBeVisible();
});

test("uses accessible state tabs on mobile", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 720, "Mobile-only semantics");
  await page.goto("/");

  const doing = page.getByRole("tab", { name: "Doing 0" });
  const todo = page.getByRole("tab", { name: "To Do 0" });
  await expect(doing).toHaveAttribute("aria-selected", "true");
  await todo.click();
  await expect(todo).toHaveAttribute("aria-selected", "true");
});

test("moves through populated states and cards with arrow keys", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose board").selectOption("demo");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;

  if (isMobile) {
    const doingTab = page.getByRole("tab", { name: "Doing 7" });
    const todoTab = page.getByRole("tab", { name: "To Do 7" });
    await doingTab.focus();
    await doingTab.press("ArrowRight");
    await expect(todoTab).toBeFocused();
    await expect(todoTab).toHaveAttribute("aria-selected", "true");
    await todoTab.press("ArrowDown");
  } else {
    const doingHeader = page.getByRole("group", { name: "Doing state, 7 items" });
    const todoHeader = page.getByRole("group", { name: "To Do state, 7 items" });
    await doingHeader.focus();
    await doingHeader.press("ArrowRight");
    await expect(todoHeader).toBeFocused();
    await todoHeader.press("ArrowDown");
  }

  const firstTodoItem = page.getByRole("button", { name: "Open Update LinkedIn headline" });
  const secondTodoItem = page.getByRole("button", { name: "Open Add two strength sessions" });
  await expect(firstTodoItem).toBeFocused();
  await firstTodoItem.press("ArrowDown");
  await expect(secondTodoItem).toBeFocused();
  await secondTodoItem.press("ArrowLeft");

  const matchingDoingItem = page.getByRole("button", { name: "Open Three-run training week" });
  await expect(matchingDoingItem).toBeFocused();
  await matchingDoingItem.press("Escape");
  if (isMobile) {
    await expect(page.getByRole("tab", { name: "Doing 7" })).toBeFocused();
  } else {
    await expect(page.getByRole("group", { name: "Doing state, 7 items" })).toBeFocused();
  }
});

test("moves between workspace views before entering their content", async ({ page }) => {
  await page.goto("/");
  const boardNav = page.getByRole("button", { name: "Open My Life Lanes" });
  const brainDumpNav = page.getByRole("button", { name: "Open Brain Dump" });
  const achievementsNav = page.getByRole("button", { name: "Open Achievements" });

  await expect(boardNav).toBeFocused();
  await boardNav.press("ArrowRight");
  await expect(brainDumpNav).toBeFocused();
  await expect(page.getByRole("heading", { name: "Brain Dump" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.viewDirection))
    .toBe("forward");

  await brainDumpNav.press("ArrowDown");
  const composer = page.getByLabel("Brain Dump note");
  await expect(composer).toBeFocused();
  await expect(boardNav).toHaveCSS("filter", "blur(0.65px)");
  await composer.press("ArrowUp");
  await expect(brainDumpNav).toBeFocused();
  await brainDumpNav.press("ArrowDown");
  await composer.press("Escape");
  await expect(brainDumpNav).toBeFocused();

  await brainDumpNav.press("ArrowRight");
  await expect(achievementsNav).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Achievements", exact: true }),
  ).toBeVisible();
  await achievementsNav.press("ArrowDown");
  const achievements = page.locator('[data-workspace-panel="achievements"]');
  await expect(achievements).toBeFocused();
  await achievements.press("ArrowUp");
  await expect(achievementsNav).toBeFocused();

  await achievementsNav.press("ArrowLeft");
  await expect(brainDumpNav).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.viewDirection))
    .toBe("backward");
  await brainDumpNav.press("ArrowLeft");
  await expect(boardNav).toBeFocused();

  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;
  await boardNav.press("ArrowDown");
  const doingState = isMobile
    ? page.getByRole("tab", { name: "Doing 0" })
    : page.getByRole("group", { name: "Doing state, 0 items" });
  await expect(doingState).toBeFocused();
  await expect(brainDumpNav).toHaveCSS("filter", "blur(0.65px)");
  await doingState.press("ArrowUp");
  await expect(boardNav).toBeFocused();

  const search = page.getByPlaceholder("Search items");
  await search.focus();
  await search.press("ArrowLeft");
  await expect(search).toBeFocused();
});

test("returns from the Achievements list with ArrowUp", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose board").selectOption("demo");
  const achievementsNav = page.getByRole("button", {
    name: "Open Achievements",
  });

  await achievementsNav.click();
  await achievementsNav.press("ArrowDown");
  const firstAchievement = page.locator(
    '[data-workspace-panel="achievements"] [data-workspace-entry]',
  );
  await expect(firstAchievement).toBeFocused();

  await firstAchievement.press("ArrowUp");
  await expect(achievementsNav).toBeFocused();
});

test("keeps workspace arrows available after clicking neutral canvas", async ({ page }) => {
  await page.goto("/");

  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("button", { name: "Open Brain Dump" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Brain Dump" })).toBeVisible();
});

test("returns to My Life Lanes reliably by pointer", async ({ page }) => {
  await page.goto("/");
  const boardNav = page.getByRole("button", { name: "Open My Life Lanes" });
  const achievementsNav = page.getByRole("button", { name: "Open Achievements" });

  await achievementsNav.click();
  await expect(
    page.getByRole("heading", { name: "Achievements", exact: true }),
  ).toBeVisible();

  await boardNav.click();
  await expect(page.getByRole("main", { name: "Life Lanes board" })).toBeVisible();
  await expect(boardNav).toBeFocused();
  await expect(boardNav).toHaveAttribute("aria-current", "page");
});

test("keeps each workspace on the same responsive frame", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto("/");

  const frame = async (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right };
    });

  const boardFrame = await frame(".board-view");
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  const captureFrame = await frame(".capture-view");
  await page.getByRole("button", { name: "Open Achievements" }).click();
  const achievementsFrame = await frame(".achievements-view");

  expect(captureFrame).toEqual(boardFrame);
  expect(achievementsFrame).toEqual(boardFrame);
});

test("enters an empty state at its first add control", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;
  const stateTarget = isMobile
    ? page.getByRole("tab", { name: "Doing 0" })
    : page.getByRole("group", { name: "Doing state, 0 items" });
  const addTargets = page.locator('[data-board-column="doing"][data-board-nav="add"]');
  await expect(addTargets).toHaveCount(5);

  await stateTarget.focus();
  await stateTarget.press("ArrowDown");
  await expect(addTargets.first()).toBeFocused();
});

test("syncs personal changes across open tabs", async ({ context, page }) => {
  await page.goto("/");
  const secondPage = await context.newPage();
  await secondPage.goto("/");

  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Brain Dump note").fill("Visible in both tabs");
  await page.getByRole("main").getByRole("button", { name: "Capture", exact: true }).click();

  await secondPage.getByRole("button", { name: "Open Brain Dump" }).click();
  await expect(secondPage.getByText("Visible in both tabs")).toBeVisible();
});

test("lets the user choose where items go when deleting a populated lane", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Choose board").selectOption("demo");
  await page.getByRole("button", { name: "Customize board" }).click();
  await page.getByRole("dialog", { name: "Customize Life Lanes" }).getByRole("button", { name: "Delete Career" }).click();

  const deleteDialog = page.getByRole("dialog", { name: "Delete Career?" });
  await expect(deleteDialog).toContainText("items will be moved");
  await deleteDialog.getByLabel("Move items to").selectOption({ label: "Fitness" });
  await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Undo" }).click();

  await expect(page.getByRole("button", { name: "Career", exact: true })).toBeVisible();
});
