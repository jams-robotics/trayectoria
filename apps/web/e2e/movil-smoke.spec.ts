import { devices, expect, test, type ConsoleMessage, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import aula from '../../../packages/i18n/locales/es/aula.json' with { type: 'json' };
import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };
import { E2E_PASSWORD, signUp } from './helpers/supabase';

/**
 * F7-04 acceptance criterion 2: a mobile smoke pass, `devices['iPhone 12']` (390 px), over 5
 * representative pages. For each: no console errors, no horizontal scroll, and the main controls
 * are visible.
 */

// `defaultBrowserType` of the device descriptor is WebKit; forced to chromium (see
// playwright.local.config.ts) since only Chromium is installed in this repo.
test.use({ ...devices['iPhone 12'], defaultBrowserType: 'chromium', browserName: 'chromium' });

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** No horizontal overflow at the viewport width. */
async function hasNoHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
}

/** Collects `pageerror` and console `error` messages raised while `run` executes. */
async function consoleErrors(page: Page, run: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const onPageError = (error: Error): void => void errors.push(error.message);
  const onConsole = (message: ConsoleMessage): void => {
    if (message.type() === 'error') errors.push(message.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  try {
    await run();
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
  return errors;
}

test.describe('F7-04 · smoke móvil (390 px)', () => {
  test('inicio', async ({ page }) => {
    const errors = await consoleErrors(page, async () => {
      await page.goto('/');
      await expect(page.locator('h1').first()).toBeVisible();
    });
    expect(errors).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    await expect(page.getByRole('link', { name: common.home.startRoute })).toBeVisible();
  });

  // A topic page mixes `client:load` and `client:visible` islands (Explora's simulators, each
  // Verifica exercise): the `client:visible` ones only hydrate once scrolled into view, so
  // `openHydrated`'s "every astro-island lost its ssr attribute" wait (built for /auth and /aula,
  // all `client:load`) never resolves here. What matters for a smoke pass is that the page itself
  // loads and its main control — the first exercise, `client:visible` and near the top of
  // Verifica — hydrates enough to render.
  test('un tema de nivel inicial (m00-t01)', async ({ page }) => {
    const errors = await consoleErrors(page, async () => {
      await page.goto('/ruta/ruta-1/m00/t01');
      await expect(page.locator('h1').first()).toBeVisible();
    });
    expect(errors).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    const exercise = page.getByTestId('exercise').first();
    await exercise.scrollIntoViewIfNeeded();
    await expect(exercise.getByRole('textbox')).toBeVisible();
  });

  test('un tema del seguidor de línea (ruta-2/m02-t01)', async ({ page }) => {
    const errors = await consoleErrors(page, async () => {
      await page.goto('/ruta/ruta-2/m02/t01');
      await expect(page.locator('h1').first()).toBeVisible();
    });
    expect(errors).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    const exercise = page.getByTestId('exercise').first();
    await exercise.scrollIntoViewIfNeeded();
    await expect(exercise.getByRole('textbox')).toBeVisible();
  });

  test('simulador móvil', async ({ page }) => {
    const errors = await consoleErrors(page, async () => {
      await page.goto('/simuladores/movil');
      await expect(page.getByTestId('start-pose-s')).toBeVisible();
    });
    expect(errors).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
    // At mobile widths the page renders its own sticky bottom bar instead of `SimControls`
    // (apps/web/src/components/sim/BottomBar.tsx, F4-02b decisión 4; #531): Reproducir, Pausa,
    // Paso, Reiniciar and the speed selector.
    const bar = page.getByTestId('sim-bottom-bar');
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Reproducir' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Pausa' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Paso' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Reiniciar' })).toBeVisible();
  });

  test('simulador de brazo', async ({ page }) => {
    const errors = await consoleErrors(page, async () => {
      await page.goto('/simuladores/brazo');
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('canvas').first()).toBeVisible();
    });
    expect(errors).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });

  test('el aula del docente', async ({ page }) => {
    const email = uniqueEmail('movil-smoke-docente');
    await signUp('teacher', 'Docente smoke móvil', email);
    await openHydrated(page, '/auth/login');
    await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
    await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
    await page.waitForURL('**/cuenta');

    const errors = await consoleErrors(page, async () => {
      await openHydrated(page, '/aula');
      await expect(page.getByRole('button', { name: aula.groups.new })).toBeVisible();
    });
    expect(errors).toEqual([]);
    expect(await hasNoHorizontalScroll(page)).toBe(true);
  });
});
