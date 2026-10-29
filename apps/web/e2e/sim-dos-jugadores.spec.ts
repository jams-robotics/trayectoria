import { expect, test, type Page } from '@playwright/test';

import sims from '../../../packages/i18n/locales/es/sims.json' with { type: 'json' };

/**
 * Two players in the 3D track (#682): the board waits for the first key, WASD and the arrows
 * each start the race, and the free arena counts stars for both.
 */

const arena = sims.arena;
const duo = arena.duo;
/** The 3D chunk (three.js) is lazy; a cold dev server takes a while to serve it. */
const LOAD_TIMEOUT_MS = 30_000;
/** Long enough for a race that started on its own to show on the stopwatch. */
const IDLE_MS = 1_500;

async function openDuo(page: Page, free: boolean): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/simuladores/carrito');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
  await page.getByRole('tab', { name: arena.tabs.track }).click();
  if (free) await page.getByRole('button', { name: new RegExp(arena.free.card) }).click();
  await page.getByRole('button', { name: duo.start }).click();
  return errors;
}

function board(page: Page) {
  return page.getByRole('region', { name: arena.free.board });
}

/** Holds `key` until the stopwatch leaves zero: that player's robot moved. */
async function driveWith(page: Page, key: string): Promise<void> {
  await expect(board(page)).toContainText('0.0 s');
  await page.waitForTimeout(IDLE_MS);
  await expect(board(page)).toContainText('0.0 s');
  await page.keyboard.down(key);
  await expect(board(page)).not.toContainText('0.0 s');
  await page.keyboard.up(key);
}

test.describe('2 jugadores', () => {
  test.slow();

  test('on the track, WASD starts the race of player 1', async ({ page }) => {
    const errors = await openDuo(page, false);
    await expect(board(page)).toContainText(duo.player.replace('{{n}}', '1'));
    await expect(board(page)).toContainText(duo.player.replace('{{n}}', '2'));
    await expect(board(page)).toContainText('0/3');
    await driveWith(page, 'w');
    expect(errors).toEqual([]);
  });

  test('on the track, the arrows start the race of player 2', async ({ page }) => {
    await openDuo(page, false);
    await driveWith(page, 'ArrowUp');
  });

  test('in the free arena both count stars, and the way back is one player', async ({ page }) => {
    const errors = await openDuo(page, true);
    await expect(board(page)).toContainText(arena.free.goals);
    await driveWith(page, 'ArrowUp');
    await page.getByRole('button', { name: duo.back }).click();
    await expect(board(page)).not.toContainText(duo.player.replace('{{n}}', '2'));
    expect(errors).toEqual([]);
  });
});
