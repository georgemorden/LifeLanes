import { expect, test, type Page } from "@playwright/test";

const isMobilePage = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 720;

async function openBoardOptions(page: Page) {
  if (isMobilePage(page)) {
    await page.getByRole("button", { name: "Open board options" }).click();
  }
}

async function openBoardSettings(page: Page) {
  await openBoardOptions(page);
  await page.getByRole("button", { name: "Customize board" }).click();
  if (!isMobilePage(page)) {
    await page
      .getByRole("menu", { name: "Customize board" })
      .getByRole("menuitem", { name: "Edit Life Lanes" })
      .click();
  }
}

async function swipeWorkspace(
  page: Page,
  selector: string,
  startX: number,
  endX: number,
) {
  const surface = page.locator(selector);
  const pointer = {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientY: 320,
  };
  await surface.dispatchEvent("pointerdown", {
    ...pointer,
    clientX: startX,
    button: 0,
    buttons: 1,
  });
  await surface.dispatchEvent("pointermove", {
    ...pointer,
    clientX: endX,
    button: 0,
    buttons: 1,
  });
  await surface.dispatchEvent("pointerup", {
    ...pointer,
    clientX: endX,
    button: 0,
    buttons: 0,
  });
}

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
  if (isMobile) {
    await expect(page.getByRole("tab", { name: "Doing 0" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "To Do 0" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Parked 0" })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Doing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "To Do" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Parked" })).toBeVisible();
  }
  if (isMobile) {
    await expect(page.getByText("Nothing in Doing")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item to Career in Doing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open board options" })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Add to board" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Customize board" })).toBeVisible();
  }
});

test("opens the demo board from mobile board options", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;
  test.skip(!isMobile, "Desktop no longer shows the first-run prompt row.");

  await page.getByRole("button", { name: "Open demo board", exact: true }).click();
  await expect(
    page.locator('button[aria-label="Exit demo"][aria-pressed="true"]'),
  ).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (isMobile) {
    await page.getByRole("tab", { name: /^To Do / }).click();
  }
  await expect(page.getByRole("button", { name: "Open Update CV" })).toBeVisible();
  await expect(page.getByText("Nothing in To Do")).toBeHidden();
});

test("introduces the demo and returns to the personal board", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();

  await expect(page.getByText("Your Life Lanes", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open My Life Lanes", exact: true }),
  ).toBeVisible();
  for (let step = 1; step < 4; step += 1) {
    await page.getByRole("button", { name: "Next", exact: true }).click();
  }

  await page.getByRole("button", { name: "Back to my board" }).click();
  await expect(page.getByRole("button", { name: "Open demo board" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.getByRole("button", { name: "Open My Life Lanes" })).toBeVisible();
});

test("reorders Life Lanes from the board and keeps the order", async ({ page }) => {
  await page.goto("/");
  test.skip(await isMobilePage(page), "Mobile keeps lane ordering in Board settings.");

  const careerHandle = page.getByRole("button", { name: "Reorder Career" });
  await careerHandle.focus();
  await careerHandle.press("Space");
  await page.waitForTimeout(60);
  await careerHandle.press("ArrowDown");
  await page.waitForTimeout(60);
  await careerHandle.press("Space");

  await expect(page.getByRole("button", { name: "Reorder Career" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAccessibleName(
    "Reorder Health",
  );

  await page.reload();
  await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAccessibleName(
    "Reorder Health",
  );
});

test("reorders Life Lanes from Customize", async ({ page }) => {
  await page.goto("/");
  await openBoardSettings(page);

  const careerHandle = page
    .getByRole("dialog", { name: "Customize Life Lanes" })
    .getByRole("button", { name: "Reorder Career" });
  await careerHandle.focus();
  await careerHandle.press("Space");
  await page.waitForTimeout(60);
  await careerHandle.press("ArrowDown");
  await page.waitForTimeout(60);
  await careerHandle.press("Space");

  const dialogHandles = page
    .getByRole("dialog", { name: "Customize Life Lanes" })
    .getByRole("button", { name: /^Reorder / });
  await expect(dialogHandles.first()).toHaveAccessibleName("Reorder Health");
});

test("reorders states from Customize", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/");
  await openBoardSettings(page);

  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  await dialog.getByRole("button", { name: "Edit States" }).click();
  await expect(dialog.getByRole("button", { name: "Reorder Doing" })).toBeVisible();
  await page.waitForTimeout(300);

  const doingHandle = dialog.getByRole("button", { name: "Reorder Doing" });
  await doingHandle.focus();
  await doingHandle.press("Space");
  await page.waitForTimeout(60);
  await doingHandle.press("ArrowDown");
  await page.waitForTimeout(60);
  await doingHandle.press("Space");

  const stateHandles = dialog.getByRole("button", { name: /^Reorder / });
  await expect(stateHandles.first()).toHaveAccessibleName("Reorder To Do");
  await expect(dialog.getByRole("button", { name: "Reorder Achievements" })).toHaveCount(0);
});

test("keeps the Brain Dump composer quiet and focused", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  const title = page.getByLabel("Note title");
  const content = page.getByLabel("Note content");
  const saveNote = page.getByRole("button", { name: "Save note" });
  await expect(title).toHaveAttribute("placeholder", "Take a note...");
  await expect(title).not.toBeFocused();
  await expect(content).toBeHidden();
  await expect(saveNote).toBeDisabled();
  await title.fill("A thought worth keeping");
  await expect(title).toHaveAttribute("placeholder", "Title");
  await expect(content).toBeHidden();
  await title.press("Enter");
  await expect(content).toBeVisible();
  await expect(content).toBeFocused();
  await content.fill("A little more context.");
  await expect(content).toHaveValue("A little more context.");
  await content.press("End");
  await content.press("Shift+Enter");
  await expect(content).toHaveValue("A little more context.\n");
  await expect(saveNote).toBeEnabled();
  await expect(page.getByText("Start with", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage Life Lanes" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Brain Dump" })).toHaveCount(0);
});

test("captures a brain dump as a note", async ({ page }) => {
  await page.goto("/");

  const brainDumpNav = page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" });
  await brainDumpNav.click();
  await page.getByLabel("Note title").fill("Book a quiet money reset");
  await page.getByLabel("Note title").press("Enter");
  await expect(page.getByLabel("Note content")).toBeFocused();
  await page.getByLabel("Note content").press("Enter");

  await expect(page.getByRole("heading", { name: "Book a quiet money reset" })).toBeVisible();
  await expect(page.getByRole("article").first()).toHaveCSS("animation-name", "note-land");
  await expect(page.getByLabel("Note title")).toHaveValue("");
  await expect(page.getByLabel("Note title")).not.toBeFocused();
  await expect(brainDumpNav).toBeFocused();
  await brainDumpNav.press("ArrowDown");
  await expect(page.getByLabel("Note title")).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Organise Book a quiet money reset" }),
  ).toBeVisible();
});

test("edits a saved Brain Dump note", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Note title").fill("A rough idea");
  await page.getByLabel("Note title").press("Enter");
  await page.getByLabel("Note content").fill("The first version.");
  await page.getByLabel("Note content").press("Enter");

  await page.getByRole("button", { name: "Edit A rough idea" }).click();
  const noteDialog = page.getByRole("dialog", { name: "Edit note" });
  await noteDialog.getByLabel("Note title").fill("A clearer idea");
  await noteDialog.getByLabel("Note content").fill("The useful version.");
  await noteDialog.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByRole("heading", { name: "A clearer idea" })).toBeVisible();
  await expect(page.getByText("The useful version.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Note updated" })).toBeVisible();
});

test("reorders Brain Dump notes with the keyboard and keeps the order", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Brain Dump" }).click();

  const captureNote = async (title: string) => {
    await page.getByLabel("Note title").fill(title);
    await page.getByLabel("Note title").press("Enter");
    await page.getByLabel("Note content").press("Enter");
    await expect(page.locator(".brain-dump-form")).not.toHaveClass(/is-saving/);
  };

  await captureNote("First thought");
  await captureNote("Second thought");
  await captureNote("Third thought");

  const reorderThird = page.getByRole("button", { name: "Reorder Third thought" });
  await reorderThird.focus();
  await reorderThird.press((page.viewportSize()?.width ?? 1280) <= 720 ? "ArrowDown" : "ArrowRight");

  const titles = page.locator(".brain-note-card:not(.drag-overlay) h2");
  await expect(titles).toHaveText(["Second thought", "Third thought", "First thought"]);
  await page.waitForTimeout(160);

  await page.reload();
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await expect(page.locator(".brain-note-card:not(.drag-overlay) h2")).toHaveText([
    "Second thought",
    "Third thought",
    "First thought",
  ]);
});

test("reorders Brain Dump notes with the pointer", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) <= 720, "Desktop pointer journey");
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();
  await page.getByRole("button", { name: "Open Brain Dump" }).click();

  const source = page.getByRole("button", { name: "Reorder Pottery class" });
  const target = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Ask about mentoring" }) });
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(sourceBox!.x + 10, sourceBox!.y + sourceBox!.height / 2, {
    steps: 4,
  });
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 16 },
  );
  await page.mouse.up();

  await expect(page.locator(".brain-note-card:not(.drag-overlay) h2")).toHaveText([
    "Lisbon weekend",
    "Ask about mentoring",
    "Pottery class",
  ]);
});

test("triages a note into a Life Lane", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  await page.getByLabel("Note title").fill("Plan a family lunch");
  await page.getByLabel("Note title").press("Enter");
  await page.getByLabel("Note content").fill("Pick a Sunday and keep it simple.");
  await page.getByLabel("Note content").press("Enter");
  await page
    .getByRole("article")
    .filter({ hasText: "Plan a family lunch" })
    .getByRole("button", { name: "Organise Plan a family lunch" })
    .click();
  await expect(page.getByLabel("Triage title")).toHaveValue("Plan a family lunch");
  await expect(page.getByLabel("Triage notes")).toHaveValue(
    "Pick a Sunday and keep it simple.",
  );
  await page.getByLabel("Triage Life Lane").selectOption({ label: "Relationships" });
  await page.getByLabel("Triage start date").fill("2026-09-01");
  await page.getByLabel("Triage end date").fill("2026-09-30");
  await page.getByRole("button", { name: "Add to board" }).click();
  await page.getByRole("button", { name: "Open My Life Lanes" }).click();
  if ((page.viewportSize()?.width ?? 1280) <= 720) {
    await page.getByRole("tab", { name: "To Do 1" }).click();
  }

  await expect(page.getByRole("button", { name: "Open Plan a family lunch" })).toBeVisible();
  await page.getByRole("button", { name: "Open Plan a family lunch" }).click();
  await expect(page.getByLabel("Start date")).toHaveValue("2026-09-01");
  await expect(page.getByLabel("End date")).toHaveValue("2026-09-30");
});

test("moves completed items into Achievements", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();

  await page.getByRole("button", { name: "Complete Finish portfolio case study" }).click();
  await page.getByRole("button", { name: "Open Achievements" }).click();

  await expect(page.getByRole("button", { name: "Open Finish portfolio case study" })).toBeVisible();
});

test("moves an achievement back to Life Lanes from its details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();
  await page.getByRole("button", { name: "Open Achievements" }).click();
  await page.getByRole("button", { name: "Open Updated portfolio homepage" }).click();

  const itemDialog = page.getByRole("dialog", { name: "Item details" });
  await expect(itemDialog.getByRole("button", { name: "Move to Life Lanes" })).toBeVisible();
  await expect(itemDialog.getByRole("button", { name: "Move to notes" })).toHaveCount(0);
  await itemDialog.getByRole("button", { name: "Move to Life Lanes" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Restored to To Do" })).toBeVisible();
  await page.getByRole("button", { name: "Open My Life Lanes", exact: true }).click();
  if (isMobilePage(page)) {
    await page.getByRole("tab", { name: /^To Do / }).click();
  }
  await expect(page.getByRole("button", { name: "Open Updated portfolio homepage" })).toBeVisible();
});

test("moves an item back to Brain Dump without losing its details", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();
  await page.getByRole("button", { name: "Open Build emergency fund" }).click();

  const itemDialog = page.getByRole("dialog", { name: "Item details" });
  await itemDialog.getByRole("button", { name: "Move to notes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Moved to notes" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await expect(page.getByRole("heading", { name: "Build emergency fund" })).toBeVisible();

  await page.getByRole("button", { name: "Organise Build emergency fund" }).click();
  const triageDialog = page.getByRole("dialog", { name: "Organise note" });
  await expect(triageDialog.getByLabel("Triage notes")).toHaveValue(
    /Set up a monthly transfer/,
  );
  await expect(triageDialog.getByRole("button", { name: "High" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(triageDialog.getByLabel("Triage start date")).not.toHaveValue("");
  await expect(triageDialog.getByLabel("Triage end date")).not.toHaveValue("");
});

test("keeps personal notes after refresh", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Workspace" })
    .getByRole("button", { name: "Open Brain Dump" })
    .click();
  await page.getByLabel("Note title").fill("Keep this after refresh");
  await page.getByLabel("Note title").press("Enter");
  await page.getByRole("main").getByRole("button", { name: "Save note", exact: true }).click();
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
  await openBoardSettings(page);
  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  await dialog.getByRole("button", { name: "Edit States" }).click();
  await dialog.getByLabel("State name").fill("Completed");
  await dialog.getByRole("button", { name: "Add state" }).click();

  await expect(dialog.getByLabel("Rename Completed")).toBeEnabled();
  await expect(dialog.getByRole("button", { name: "Delete Completed" })).toBeVisible();
  await expect(dialog.getByText("System")).toHaveCount(1);
});

test("adds a state directly from the board header", async ({ page }) => {
  test.skip(isMobilePage(page), "Desktop matrix header only");
  await page.goto("/");
  await page.getByRole("button", { name: "Add to board" }).click();
  await page.getByRole("menu", { name: "Add to board" }).getByRole("menuitem", { name: "State" }).click();

  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  const stateName = dialog.getByLabel("State name");
  await expect(stateName).toBeFocused();
  await stateName.fill("Waiting");
  await dialog.getByRole("button", { name: "Add state" }).click();
  await expect(stateName).toBeFocused();
  await dialog.getByRole("button", { name: "Close Customize Life Lanes" }).click();

  if ((page.viewportSize()?.width ?? 1280) <= 720) {
    await expect(page.getByRole("tab", { name: "Waiting 0" })).toBeVisible();
  } else {
    await expect(page.getByRole("group", { name: "Waiting state, 0 items" })).toBeVisible();
  }
});

test("keeps Personal and Demo lane preferences separate", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Note title").fill("Keep my board controls visible");
  await page.getByLabel("Note title").press("Enter");
  await page.getByRole("main").getByRole("button", { name: "Save note", exact: true }).click();
  await page.getByRole("button", { name: "Open My Life Lanes" }).click();

  await page.getByRole("button", { name: "Open demo board" }).click();

  await openBoardOptions(page);

  const showAll = page.getByRole("button", { name: "Show all lanes" });
  await showAll.click();
  await expect(page.getByRole("button", { name: "Focus on active lanes" })).toBeVisible();

  await page
    .locator(
      isMobilePage(page)
        ? 'button.mobile-demo-button[aria-label="Exit demo"]'
        : 'button.board-demo-button[aria-label="Exit demo"]',
    )
    .click();
  await openBoardOptions(page);
  await expect(page.getByRole("button", { name: "Show all lanes" })).toBeVisible();

  await page.getByRole("button", { name: "Open demo board" }).click();
  await openBoardOptions(page);
  await expect(page.getByRole("button", { name: "Focus on active lanes" })).toBeVisible();
});

test("previews and safely normalizes an imported backup", async ({ page }) => {
  await page.goto("/");
  await openBoardSettings(page);
  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  await dialog.getByRole("button", { name: "Edit States" }).click();
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
    drafts: [
      {
        id: "draft-legacy",
        text: "Legacy note title\nLegacy supporting detail.",
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
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
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await expect(page.getByRole("heading", { name: "Legacy note title" })).toBeVisible();
  await expect(page.getByText("Legacy supporting detail.")).toBeVisible();
});

test("warns when browser storage cannot save", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Note title").fill("Keep this visible in memory");
  await page.getByLabel("Note title").press("Enter");
  await page.getByRole("main").getByRole("button", { name: "Save note", exact: true }).click();

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
  await page.getByRole("button", { name: "Open demo board" }).click();
  await openBoardOptions(page);
  await page.getByPlaceholder("Search items").fill("Build emergency fund");

  await expect(page.getByRole("button", { name: "Open Build emergency fund" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Finish portfolio case study" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.getByRole("button", { name: "Open Finish portfolio case study" })).toBeVisible();
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
  await page.getByRole("button", { name: "Open demo board" }).click();
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;

  if (isMobile) {
    const doingTab = page.getByRole("tab", { name: "Doing 3" });
    const todoTab = page.getByRole("tab", { name: "To Do 5" });
    await doingTab.focus();
    await doingTab.press("ArrowRight");
    await expect(todoTab).toBeFocused();
    await expect(todoTab).toHaveAttribute("aria-selected", "true");
    await expect(todoTab).toHaveCSS("animation-name", "keyboard-control-focus");
    await todoTab.press("ArrowDown");
  } else {
    const doingHeader = page.getByRole("group", { name: "Doing state, 3 items" });
    const todoHeader = page.getByRole("group", { name: "To Do state, 5 items" });
    await doingHeader.focus();
    await doingHeader.press("ArrowRight");
    await expect(todoHeader).toBeFocused();
    await expect(todoHeader).toHaveCSS("animation-name", "keyboard-slot-focus");
    await todoHeader.press("ArrowDown");
  }

  const firstTodoItem = page.getByRole("button", { name: "Open Update CV" });
  const secondTodoItem = page.getByRole("button", { name: "Open Book a health check" });
  await expect(firstTodoItem).toBeFocused();
  await expect(page.locator(".note-card").filter({ has: firstTodoItem })).toHaveCSS(
    "animation-name",
    "keyboard-card-focus",
  );
  await firstTodoItem.press("ArrowDown");
  await expect(secondTodoItem).toBeFocused();
  await secondTodoItem.press("ArrowLeft");

  const matchingDoingItem = page.getByRole("button", { name: "Open Three workouts this week" });
  await expect(matchingDoingItem).toBeFocused();
  await matchingDoingItem.press("Escape");
  if (isMobile) {
    await expect(page.getByRole("tab", { name: "Doing 3" })).toBeFocused();
  } else {
    await expect(page.getByRole("group", { name: "Doing state, 3 items" })).toBeFocused();
  }
});

test("drags a card into another state with the pointer", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) <= 720, "Desktop pointer journey");
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();

  const source = page.getByRole("button", {
    name: "Drag Update CV",
  });
  const targetItem = page.getByRole("button", {
    name: "Open Finish portfolio case study",
  });
  const targetCell = page.locator(".matrix-cell").filter({ has: targetItem });
  const sourceBox = await source.boundingBox();
  const targetBox = await targetItem.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  await page.mouse.move(
    sourceBox!.x + sourceBox!.width / 2,
    sourceBox!.y + sourceBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(sourceBox!.x - 12, sourceBox!.y + sourceBox!.height / 2, {
    steps: 4,
  });
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 16 },
  );
  await page.mouse.up();
  await expect(
    targetCell.getByRole("button", { name: "Open Update CV" }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Doing state, 4 items" })).toBeVisible();
});

test("moves between workspace views before entering their content", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;
  const boardNav = page.getByRole("button", { name: "Open My Life Lanes" });
  const brainDumpNav = page.getByRole("button", { name: "Open Brain Dump" });
  const achievementsNav = page.getByRole("button", { name: "Open Achievements" });

  await expect(boardNav).toBeFocused();
  await boardNav.press("ArrowRight");
  await expect(brainDumpNav).toBeFocused();
  await expect(page.getByRole("main", { name: "Brain Dump" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.viewDirection))
    .toBe("forward");

  await brainDumpNav.press("ArrowDown");
  const composer = page.getByLabel("Note title");
  await expect(composer).toBeFocused();
  await expect(boardNav).toHaveCSS("filter", "none");
  await composer.press("ArrowUp");
  await expect(brainDumpNav).toBeFocused();
  await brainDumpNav.press("ArrowDown");
  await composer.press("Escape");
  await expect(brainDumpNav).toBeFocused();

  await brainDumpNav.press("ArrowRight");
  await expect(achievementsNav).toBeFocused();
  await expect(page.getByRole("main", { name: "Achievements" })).toBeVisible();
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

  await boardNav.press("ArrowDown");
  const doingState = isMobile
    ? page.getByRole("tab", { name: "Doing 0" })
    : page.getByRole("group", { name: "Doing state, 0 items" });
  await expect(doingState).toBeFocused();
  await expect(brainDumpNav).toHaveCSS("filter", "none");
  await doingState.press("ArrowUp");
  await expect(boardNav).toBeFocused();

  await page.getByRole("button", { name: "Open demo board" }).click();
  await openBoardOptions(page);
  const search = page.getByPlaceholder("Search items");
  await search.focus();
  await search.press("ArrowLeft");
  await expect(search).toBeFocused();
});

test("turns and opens the brand lanes with keyboard direction", async ({ page }) => {
  await page.goto("/");
  const brandMark = page.locator(".brand-mark");
  const boardNav = page.getByRole("button", { name: "Open My Life Lanes" });
  const brainDumpNav = page.getByRole("button", { name: "Open Brain Dump" });
  const achievementsNav = page.getByRole("button", { name: "Open Achievements" });

  await expect(brandMark).toHaveAttribute("data-turns", "0");
  await boardNav.press("ArrowRight");
  await expect(brandMark).toHaveAttribute("data-turns", "1");
  await brainDumpNav.press("ArrowRight");
  await expect(brandMark).toHaveAttribute("data-turns", "2");
  await achievementsNav.press("ArrowRight");
  await expect(brandMark).toHaveAttribute("data-turns", "4");
  await boardNav.press("ArrowLeft");
  await expect(brandMark).toHaveAttribute("data-turns", "2");

  await achievementsNav.press("ArrowLeft");
  await expect(brainDumpNav).toBeFocused();
  await expect(brandMark).toHaveAttribute("data-turns", "1");
  await brainDumpNav.press("ArrowLeft");
  await expect(boardNav).toBeFocused();
  await expect(brandMark).toHaveAttribute("data-turns", "0");

  await expect
    .poll(() => brandMark.evaluate((element) => getComputedStyle(element).getPropertyValue("--brand-lane-offset").trim()))
    .toBe("10px");
  await boardNav.press("ArrowDown");
  await expect
    .poll(() => brandMark.evaluate((element) => getComputedStyle(element).getPropertyValue("--brand-lane-offset").trim()))
    .toBe("13px");
});

test("respects reduced motion without removing feedback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();

  const animationDuration = await page
    .locator(".board-view")
    .evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
  expect(animationDuration).toBeLessThan(0.001);

  if ((page.viewportSize()?.width ?? 1280) <= 720) {
    await page.getByRole("tab", { name: "Doing 3" }).click();
  }
  await page
    .getByRole("button", { name: "Complete Finish portfolio case study" })
    .click();
  await expect(page.locator(".completion-flight")).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Added to Achievements" }),
  ).toBeVisible();
});

test("keeps item titles visible when a Life Lane is collapsed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();

  const careerToggle = page.getByRole("button", { name: "Career", exact: true });
  await careerToggle.click();
  await expect(careerToggle).toHaveAttribute("aria-expanded", "false");

  const preview = page
    .locator(".matrix-row-contents.is-collapsed")
    .locator('[data-column="doing"] .collapsed-lane-preview');
  await expect(preview.getByText("Finish portfolio case study", { exact: true })).toBeVisible();
  await expect(preview.getByText("High", { exact: true })).toHaveCount(0);
});

test("moves through Achievements and returns with ArrowUp", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();
  const achievementsNav = page.getByRole("button", {
    name: "Open Achievements",
  });

  await achievementsNav.click();
  await achievementsNav.press("ArrowDown");
  const firstAchievement = page.getByRole("button", {
    name: "Open Updated portfolio homepage",
  });
  const secondAchievement = page.getByRole("button", {
    name: "Open Created emergency details folder",
  });
  await expect(firstAchievement).toBeFocused();

  await firstAchievement.press("ArrowDown");
  await expect(secondAchievement).toBeFocused();
  await secondAchievement.press("ArrowUp");
  await expect(firstAchievement).toBeFocused();
  await firstAchievement.press("ArrowUp");
  await expect(achievementsNav).toBeFocused();
});

test("deletes an achievement and offers undo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();
  await page.getByRole("button", { name: "Open Achievements" }).click();

  await page.getByRole("button", { name: "Delete Updated portfolio homepage" }).click();
  await expect(
    page.getByRole("button", { name: "Open Updated portfolio homepage" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("button", { name: "Open Updated portfolio homepage" }),
  ).toBeVisible();
});

test("keeps workspace arrows available after clicking neutral canvas", async ({ page }) => {
  await page.goto("/");

  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("button", { name: "Open Brain Dump" })).toBeFocused();
  await expect(page.getByRole("main", { name: "Brain Dump" })).toBeVisible();
});

test("returns to My Life Lanes reliably by pointer", async ({ page }) => {
  await page.goto("/");
  const boardNav = page.getByRole("button", { name: "Open My Life Lanes" });
  const achievementsNav = page.getByRole("button", { name: "Open Achievements" });

  await achievementsNav.click();
  await expect(page.getByRole("main", { name: "Achievements" })).toBeVisible();

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

test("uses a focused app frame and full-width lanes on mobile", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 720, "Mobile layout only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();

  const navigation = page.getByRole("navigation", { name: "Workspace" });
  await expect(navigation).toHaveCSS("position", "fixed");
  await openBoardOptions(page);
  await expect(page.getByRole("button", { name: "Add item to Doing" })).toBeVisible();
  await page.getByRole("button", { name: "Close board options" }).click();

  const firstRow = page.locator(".matrix-row-contents").first();
  const laneHeading = firstRow.locator(".lane-row-heading");
  const activeCell = firstRow.locator(".matrix-cell:not(.mobile-hidden)");
  const dimensions = await Promise.all([
    laneHeading.evaluate((element) => element.getBoundingClientRect().width),
    activeCell.evaluate((element) => element.getBoundingClientRect().width),
  ]);

  expect(dimensions[0]).toBeGreaterThan(320);
  expect(Math.abs(dimensions[0] - dimensions[1])).toBeLessThan(1);

  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await expect(page.getByRole("main", { name: "Brain Dump" })).toBeVisible();
  await expect(navigation).toHaveCSS("position", "fixed");
});

test("swipes between mobile workspaces without opening the keyboard", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 720, "Mobile gesture only");
  await page.goto("/");

  await swipeWorkspace(page, ".board-view", 330, 45);
  await expect(page.getByRole("main", { name: "Brain Dump" })).toBeVisible();
  await expect(page.getByLabel("Note title")).not.toBeFocused();

  await swipeWorkspace(page, ".capture-view", 330, 45);
  await expect(page.getByRole("main", { name: "Achievements" })).toBeVisible();

  await swipeWorkspace(page, ".achievements-view", 45, 330);
  await expect(page.getByRole("main", { name: "Brain Dump" })).toBeVisible();
});

test("switches presets without remounting the board controls", async ({ page }) => {
  await page.goto("/");
  const demoSwitchSelector = isMobilePage(page)
    ? ".mobile-demo-button"
    : ".board-demo-button";
  const demoSwitch = page.locator(demoSwitchSelector);
  await page.evaluate((selector) => {
    const testWindow = window as Window & {
      __lifeLanesMatrix?: Element | null;
      __lifeLanesDemoSwitch?: Element | null;
    };
    testWindow.__lifeLanesMatrix = document.querySelector(".matrix-scroll");
    testWindow.__lifeLanesDemoSwitch = document.querySelector(selector);
  }, demoSwitchSelector);

  await page.getByRole("button", { name: "Open demo board" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (selector) => {
          const testWindow = window as Window & {
            __lifeLanesMatrix?: Element | null;
            __lifeLanesDemoSwitch?: Element | null;
          };
          return (
            testWindow.__lifeLanesMatrix === document.querySelector(".matrix-scroll") &&
            testWindow.__lifeLanesDemoSwitch === document.querySelector(selector)
          );
        },
        demoSwitchSelector,
      ),
    )
    .toBe(true);
  await expect(demoSwitch).toHaveAttribute("aria-pressed", "true");
});

test("keeps short mobile viewports inside the app frame", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 720, "Mobile viewport only");
  await page.setViewportSize({ width: 390, height: 620 });
  await page.goto("/");

  const frameFits = async () =>
    page.evaluate(() => ({
      viewport: window.innerHeight,
      pageHeight: document.documentElement.scrollHeight,
      navigationBottom: document
        .querySelector(".primary-nav")
        ?.getBoundingClientRect().bottom,
    }));

  const boardFrame = await frameFits();
  expect(boardFrame.pageHeight).toBeLessThanOrEqual(boardFrame.viewport + 1);
  expect(boardFrame.navigationBottom).toBeLessThanOrEqual(boardFrame.viewport + 1);

  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  const captureFrame = await frameFits();
  expect(captureFrame.pageHeight).toBeLessThanOrEqual(captureFrame.viewport + 1);
  expect(captureFrame.navigationBottom).toBeLessThanOrEqual(captureFrame.viewport + 1);
});

test("keeps mobile board settings dismissible", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 1280) > 720, "Mobile sheet only");
  await page.setViewportSize({ width: 390, height: 620 });
  await page.goto("/");

  await openBoardSettings(page);
  const dialog = page.getByRole("dialog", { name: "Customize Life Lanes" });
  await expect(dialog).toBeVisible();
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.height).toBeLessThan(620 * 0.86);
  await expect(page.getByRole("button", { name: "Close Customize Life Lanes" })).toBeVisible();

  await page.getByRole("button", { name: "Close Customize Life Lanes" }).click();
  await expect(dialog).toHaveCount(0);

  await openBoardSettings(page);
  await page.locator(".dialog-backdrop").click({ position: { x: 12, y: 12 } });
  await expect(page.getByRole("dialog", { name: "Customize Life Lanes" })).toHaveCount(0);
});

test("enters an empty state at its first add control", async ({ page }) => {
  await page.goto("/");
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 720;
  const stateTarget = isMobile
    ? page.getByRole("tab", { name: "Doing 0" })
    : page.getByRole("group", { name: "Doing state, 0 items" });
  const addTargets = page.locator('[data-board-column="doing"][data-board-nav="add"]');
  await expect(addTargets).toHaveCount(isMobile ? 1 : 5);
  await expect(addTargets.first()).toHaveAccessibleName("Add item to Career in Doing");
  await expect(addTargets.first()).toHaveText(isMobile ? "Add item" : "");
  if (!isMobile) {
    await expect(addTargets.first()).toHaveCSS("opacity", "0");
  }

  await stateTarget.focus();
  await stateTarget.press("ArrowDown");
  await expect(addTargets.first()).toBeFocused();
  await expect(addTargets.first()).toHaveCSS("opacity", "1");
});

test("syncs personal changes across open tabs", async ({ context, page }) => {
  await page.goto("/");
  const secondPage = await context.newPage();
  await secondPage.goto("/");

  await page.getByRole("button", { name: "Open Brain Dump" }).click();
  await page.getByLabel("Note title").fill("Visible in both tabs");
  await page.getByLabel("Note title").press("Enter");
  await page.getByRole("main").getByRole("button", { name: "Save note", exact: true }).click();

  await secondPage.getByRole("button", { name: "Open Brain Dump" }).click();
  await expect(secondPage.getByText("Visible in both tabs")).toBeVisible();
});

test("lets the user choose where items go when deleting a populated lane", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo board" }).click();
  await openBoardSettings(page);
  await page.getByRole("dialog", { name: "Customize Life Lanes" }).getByRole("button", { name: "Delete Career" }).click();

  const deleteDialog = page.getByRole("dialog", { name: "Delete Career?" });
  await expect(deleteDialog).toContainText("items will be moved");
  await deleteDialog.getByLabel("Move items to").selectOption({ label: "Fitness" });
  await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Undo" }).click();

  await expect(page.getByRole("button", { name: "Career", exact: true })).toBeVisible();
});
