import { expect, test, type Page } from '@playwright/test';

import sims from '../../../packages/i18n/locales/es/sims.json' with { type: 'json' };

/**
 * The 3D track (#679): it starts racing on its own, the cameras switch, the free arena (#681)
 * opens from the track tab, and at 390 px nothing overflows sideways.
 */

const arena = sims.arena;
/** The 3D chunk (three.js) is lazy; a cold dev server takes a while to serve it. */
const LOAD_TIMEOUT_MS = 30_000;

async function openArena(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/simuladores/carrito');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
  return errors;
}

/** The text of the lap board, which changes while the robot runs. */
function lapBoard(page: Page) {
  return page.getByRole('region', { name: arena.hud.laps });
}

test('the race starts on its own and the lap clock runs', async ({ page }) => {
  const errors = await openArena(page);
  const board = lapBoard(page);
  await expect(board).toBeVisible();
  const before = await board.innerText();
  await expect.poll(() => board.innerText(), { timeout: 10_000 }).not.toBe(before);
  expect(errors).toEqual([]);
});

test('the camera buttons switch the view', async ({ page }) => {
  await openArena(page);
  const cameras = page.getByRole('radiogroup', { name: arena.camera.label });
  const top = cameras.getByRole('radio', { name: arena.camera.top });
  await top.click();
  await expect(top).toHaveAttribute('aria-checked', 'true');
  await expect(cameras.getByRole('radio', { name: arena.camera.chase })).toHaveAttribute(
    'aria-checked',
    'false',
  );
});

test('the free arena opens from the track tab with its star counter', async ({ page }) => {
  await openArena(page);
  await page.getByRole('tab', { name: arena.tabs.track }).click();
  await page.getByRole('button', { name: new RegExp(arena.free.card) }).click();
  const board = page.getByRole('region', { name: arena.free.board });
  await expect(board).toContainText(arena.free.goals);
  await expect(board).toContainText('0/5');
});

test('at 390 px the page does not scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArena(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});
