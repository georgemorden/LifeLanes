import { expect, test } from '@playwright/test';
import { createBoardState } from '../../src/data';
import { inspectImport, mergeStates, normalizeState } from '../../src/storage';

test('rejects a backup from a newer schema without downgrading it', () => {
  const board = createBoardState('draft');
  expect(inspectImport({ ...board, schemaVersion: board.schemaVersion + 1 })).toBeNull();
});

test('refuses a merge that would silently discard notes', () => {
  const board = createBoardState('draft');
  const note = { id: 'note', title: 'Keep every note', note: '', createdAt: board.updatedAt, updatedAt: board.updatedAt };
  const fullBoard = { ...board, drafts: Array.from({ length: 2000 }, (_, i) => ({ ...note, id: `note-${i}` })) };
  expect(mergeStates(fullBoard, { ...board, drafts: [note] })).toBeNull();
  expect(fullBoard.drafts).toHaveLength(2000);
  expect(inspectImport({ ...board, drafts: [...fullBoard.drafts, note] })).toBeNull();
  expect(normalizeState({ ...board, drafts: [...fullBoard.drafts, { ...note, id: 'extra' }] })?.drafts).toHaveLength(2001);
});

test('does not lose a state when an imported board needs an achievement column', () => {
  const board = createBoardState('draft');
  const columns = Array.from({ length: 24 }, (_, i) => ({ id: `state-${i}`, title: `State ${i}`, kind: 'active', createdAt: board.updatedAt }));
  expect(inspectImport({ ...board, columns })).toBeNull();
  expect(normalizeState({ ...board, columns })?.columns).toHaveLength(25);
});

test('keeps collapsed settings out of keyboard navigation and cancels a rename', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Customize board', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1280) > 720) {
    await page.getByRole('menuitem', { name: 'Edit Life Lanes', exact: true }).click();
  }
  const dialog = page.getByRole('dialog', { name: 'Customize Life Lanes' });
  const rename = dialog.getByRole('textbox', { name: 'Rename Career', exact: true });
  await rename.fill('Do not save this');
  await rename.press('Escape');
  await expect(rename).toHaveValue('Career');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit States' }).click();
  expect(await dialog.locator('.manage-accordion-content').first().evaluate(el => (el as HTMLElement).inert)).toBe(true);
  await expect(page.locator('.app-header')).toHaveJSProperty('inert', true);
  const close = dialog.getByRole('button', { name: 'Close Customize Life Lanes' });
  await close.click();
  await expect(page.locator('.app-header')).toHaveJSProperty('inert', false);
  await expect(page.getByRole('button', { name: 'Customize board', exact: true })).toBeFocused();
});

test('keeps a corrupt-board recovery download available after a new save', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('recovery-test')) {
      localStorage.setItem('life-lanes-two-panel-v1', '{broken');
      sessionStorage.setItem('recovery-test', 'yes');
    }
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('could not be opened');
  await page.getByRole('button', { name: 'Open Brain Dump', exact: true }).click();
  if ((page.viewportSize()?.width ?? 1280) <= 720) await page.getByRole('button', { name: 'Add note', exact: true }).click();
  await page.getByLabel('Note title').fill('New note');
  await page.getByLabel('Note title').press('Enter');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('life-lanes-two-panel-v1'))).toContain('New note');
  await expect(page.getByRole('alert')).toContainText('could not be opened');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toMatch(/^life-lanes-.*\.json$/);
});

test('starts demo with five lanes and reveals populated extras without changing the personal board', async ({ page }) => {
  await page.goto('/');
  const personalBefore = await page.evaluate(() => localStorage.getItem('life-lanes-two-panel-v1'));
  await page.getByRole('button', { name: 'Open demo board', exact: true }).click();
  await expect(page.locator('.matrix-row-contents')).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Learning', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all lanes', exact: true }).click();
  await expect(page.locator('.matrix-row-contents')).toHaveCount(13);
  await expect(page.locator('.matrix-row-contents.is-collapsed')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Work through a photography course', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Try a neighbourhood book swap', exact: true })).toHaveCount(1);
  const learning = page.getByRole('button', { name: 'Learning', exact: true });
  await learning.click();
  await expect(learning).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.board-demo-button, .mobile-demo-button').filter({ hasText: 'Exit demo' }).click();
  await expect(page.getByRole('button', { name: 'Open demo board', exact: true })).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('life-lanes-two-panel-v1'))).toBe(personalBefore);
  if ((page.viewportSize()?.width ?? 1280) > 720) await expect(page.locator('.matrix-row-contents')).toHaveCount(5);
  await page.getByRole('button', { name: 'Open demo board', exact: true }).click();
  await expect(page.locator('.matrix-row-contents')).toHaveCount(5);
  await page.getByRole('button', { name: 'Show all lanes', exact: true }).click();
  await expect(page.locator('.matrix-row-contents.is-collapsed')).toHaveCount(0);
});
