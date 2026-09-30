import { expect, test, type Locator, type Page } from '@playwright/test';

import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };

// #648 (RUTAS-TEXTS + portada; #582, #539): the hero is the line follower in demonstration mode,
// both calls to action stay on the first screen at 390 px, the demo does not animate for users
// who prefer reduced motion, and the module cards of the two routes link to their first topic.

/** Viewport of the mobile mockups (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** The demo loads its chunk after the page is idle; room for a cold dev server. */
const DEMO_TIMEOUT_MS = 30_000;

/** Time between the two frames compared, in milliseconds. */
const FRAME_GAP_MS = 1_000;

async function demoCanvas(page: Page): Promise<Locator> {
  const canvas = page.getByTestId('home-demo').locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: DEMO_TIMEOUT_MS });
  return canvas;
}

/** Two captures of the canvas `FRAME_GAP_MS` apart: equal means the robot did not move. */
async function framesDiffer(page: Page, canvas: Locator): Promise<boolean> {
  const first = await canvas.screenshot();
  await page.waitForTimeout(FRAME_GAP_MS);
  const second = await canvas.screenshot();
  return !first.equals(second);
}

test('the robot of the hero moves without any interaction', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(common.home.headline);
  const canvas = await demoCanvas(page);
  await expect.poll(() => framesDiffer(page, canvas), { timeout: DEMO_TIMEOUT_MS }).toBe(true);
  await expect(page.getByRole('link', { name: common.home.demo.open })).toHaveAttribute(
    'href',
    '/simuladores/movil',
  );
});

test('with prefers-reduced-motion the demo stays still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const canvas = await demoCanvas(page);
  // Let the first frames settle, then the picture must not change.
  await page.waitForTimeout(FRAME_GAP_MS);
  expect(await framesDiffer(page, canvas)).toBe(false);
});

test('at 390 px both calls to action are on the first screen, with no overflow', async ({ page }) => {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/');
  await demoCanvas(page);
  for (const name of [common.home.startRoute, common.home.tryTopic]) {
    const box = await page.getByRole('link', { name, exact: true }).boundingBox();
    expect(box, name).not.toBeNull();
    expect((box?.y ?? Infinity) + (box?.height ?? 0), name).toBeLessThanOrEqual(
      MOBILE_VIEWPORT.height,
    );
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test('the keyboard reaches both calls to action and the simulator link', async ({ page }) => {
  await page.goto('/');
  // Wait for HomeDemo to hydrate and mount the simulator link before tabbing, so the focus
  // order does not shift mid-walk when the lazy chunk lands.
  await expect(page.getByRole('link', { name: common.home.demo.open })).toBeVisible({
    timeout: DEMO_TIMEOUT_MS,
  });
  const targets = [common.home.startRoute, common.home.tryTopic, common.home.demo.open];
  const reached = new Set<string>();
  for (let step = 0; step < 30 && reached.size < targets.length; step += 1) {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    if (targets.includes(text)) reached.add(text);
  }
  expect([...reached].sort()).toEqual([...targets].sort());
});

test('the secondary call to action opens Rodadura', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: common.home.tryTopic })).toHaveAttribute(
    'href',
    '/ruta/ruta-1/m01/t04',
  );
});

test('the module cards of both routes link to their first topic', async ({ page }) => {
  await page.goto('/');
  const thread = page.locator('section[aria-labelledby="hilo-titulo"]');
  await expect(thread.getByRole('heading', { level: 3 })).toHaveText([
    'Fundamentos',
    'Robot móvil',
  ]);
  const hrefs = await thread
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(hrefs).toEqual([
    '/ruta/ruta-1/m00/t01',
    '/ruta/ruta-1/m01/t01',
    '/ruta/ruta-1/m02/t01',
    '/ruta/ruta-1/m03/t01',
    '/ruta/ruta-2/m00/t01',
    '/ruta/ruta-2/m01/t01',
    '/ruta/ruta-2/m02/t01',
  ]);
});

test('the rigor strip links to the issues labelled contenido', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(common.home.rigor.text)).toBeVisible();
  await expect(page.getByRole('link', { name: common.home.rigor.link })).toHaveAttribute(
    'href',
    /label%3Acontenido$/,
  );
});
