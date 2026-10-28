import { expect, test, type Page } from '@playwright/test';

import sims from '../../../packages/i18n/locales/es/sims.json' with { type: 'json' };

/**
 * The «Pasos» mode of the free arena (#686): the robot waits for «Ejecutar», a square written
 * with «Repetir» solves its goal, and a program into a cone stops at the hit.
 */

const steps = sims.arena.steps;
/** The 3D chunk (three.js) is lazy; a cold dev server takes a while to serve it. */
const LOAD_TIMEOUT_MS = 30_000;
/** A run of the square takes a few seconds of simulated time. */
const RUN_TIMEOUT_MS = 30_000;
/**
 * CI draws WebGL in software at a few frames per second, and the race advances at most
 * `MAX_FRAME_S` per frame: the eight moves of the square take over a minute of real time there.
 */
const SQUARE_TIMEOUT_MS = 120_000;

async function openSteps(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/simuladores/carrito');
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
  await page.getByRole('tab', { name: sims.arena.tabs.track }).click();
  await page.getByRole('button', { name: new RegExp(sims.arena.free.card) }).click();
  await page.getByRole('button', { name: sims.arena.free.toSteps }).click();
  return errors;
}

function add(page: Page, label: string): Promise<void> {
  return page.getByRole('button', { name: label, exact: true }).click();
}

function run(page: Page): Promise<void> {
  return page.getByRole('button', { name: new RegExp(steps.run) }).click();
}

function program(page: Page) {
  return page.getByRole('list', { name: steps.program });
}

test.describe('Pasos', () => {
  test.slow();

  test('the robot waits for «Ejecutar» while the program is built', async ({ page }) => {
    const errors = await openSteps(page);
    await page.getByRole('button', { name: steps.goal.square }).click();
    await add(page, steps.forward);
    await add(page, steps.left);
    await expect(program(page).getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText(steps.hint.square)).toBeVisible();
    await expect(page.getByText(steps.running.replace('{{n}}', '1'))).toHaveCount(0);

    await add(page, steps.right);
    await page.getByRole('button', { name: steps.undo }).click();
    await expect(program(page).getByRole('listitem')).toHaveCount(2);
    await page.getByRole('button', { name: steps.clear }).click();
    await expect(page.getByText(steps.empty)).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(steps.run) })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('a square written with «Repetir» solves the goal', async ({ page }) => {
    test.setTimeout(SQUARE_TIMEOUT_MS + 60_000);
    const errors = await openSteps(page);
    await page.getByRole('button', { name: steps.goal.square }).click();
    await add(page, steps.repeat.replace('{{n}}', '4'));
    await add(page, steps.forward);
    await add(page, steps.left);
    await add(page, steps.end);
    await run(page);
    const celebration = page.getByRole('dialog', { name: steps.doneSquare });
    await expect(celebration).toBeVisible({ timeout: SQUARE_TIMEOUT_MS });
    await expect(celebration).toContainText(steps.done);
    expect(errors).toEqual([]);
  });

  test('a program into a cone stops at the hit', async ({ page }) => {
    await openSteps(page);
    // The first cone sits three cells ahead of the start.
    for (let i = 0; i < 3; i += 1) await add(page, steps.forward);
    await run(page);
    await expect(page.getByText(steps.blocked.replace('{{n}}', '3'))).toBeVisible({
      timeout: RUN_TIMEOUT_MS,
    });
  });
});
