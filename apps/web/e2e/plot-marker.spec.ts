import { expect, test, type Locator, type Page } from '@playwright/test';

// Bug #107, on the `/dev/widgets` playground and with no session: the Plot marker follows a real
// mouse drag, not only the arrow keys. The visible line is 2 px wide and used to be the whole
// hit area, so a press a couple of pixels off it landed on uPlot's `.u-over` layer and no drag
// ever started; the jsdom test of `MarkerLayer` never saw it because it dispatches its pointer
// events on the element itself.

/** How far the drag travels, in CSS pixels. */
const DRAG_PX = 80;
/**
 * How far from the centre of the line the press lands, in CSS pixels. A real mouse never hits
 * the 2 px line exactly; this is inside the 12 px grab zone of the fix and outside the line.
 */
const PRESS_OFFSET_PX = 4;
/** Intermediate moves of the drag: a real mouse sends many, not one jump. */
const DRAG_STEPS = 8;

/** Opens the playground and waits for React to hydrate every island before interacting. */
async function openPlayground(page: Page): Promise<void> {
  await page.goto('/dev/widgets');
  // Astro removes the `ssr` attribute of an island once React has hydrated it; a drag landing
  // before that is silently a no-op (e2e/exercise.spec.ts, F2-01a ronda 1).
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

function marker(page: Page, widget: string, story: string): Locator {
  return page
    .locator(`[data-widget="${widget}"] [data-story="${story}"] [data-testid="plot-marker"]`)
    .first();
}

/** Reads the marker's `aria-valuenow`, the position it exposes as a slider. */
async function valueNow(target: Locator): Promise<number> {
  return Number(await target.getAttribute('aria-valuenow'));
}

/**
 * Presses `PRESS_OFFSET_PX` beside the line and drags `dx_px` with `page.mouse`. The element is
 * scrolled into the viewport first: `page.mouse` works in viewport coordinates, and the
 * playground is a long page.
 */
async function drag(page: Page, target: Locator, dx_px: number): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  const { x, y, width, height } = box ?? { x: 0, y: 0, width: 0, height: 0 };
  const offset_px = dx_px > 0 ? PRESS_OFFSET_PX : -PRESS_OFFSET_PX;
  const from_px = { x: x + width / 2 + offset_px, y: y + height / 2 };
  await page.mouse.move(from_px.x, from_px.y);
  await page.mouse.down();
  for (let step = 1; step <= DRAG_STEPS; step += 1) {
    await page.mouse.move(from_px.x + (dx_px * step) / DRAG_STEPS, from_px.y);
  }
  await page.mouse.up();
}

/** The press must land on the marker itself, not on the uPlot layer stacked under it. */
async function elementUnderPress(page: Page, target: Locator): Promise<string> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const { x, y, width, height } = box ?? { x: 0, y: 0, width: 0, height: 0 };
  return page.evaluate(
    ({ x_px, y_px }) => {
      const element = document.elementFromPoint(x_px, y_px);
      return element === null ? 'null' : (element.closest('[data-testid]')?.getAttribute('data-testid') ?? element.tagName);
    },
    { x_px: x + width / 2 + PRESS_OFFSET_PX, y_px: y + height / 2 },
  );
}

test('Plot: a mouse press beside the line lands on the marker, not on the chart (#107)', async ({
  page,
}) => {
  await openPlayground(page);
  const target = marker(page, 'Plot', 'Static');
  await expect(target).toBeVisible();

  expect(await elementUnderPress(page, target)).toBe('plot-marker');
});

test('Plot: a real mouse drag moves the marker to the right (#107)', async ({ page }) => {
  await openPlayground(page);
  const target = marker(page, 'Plot', 'Static');
  await expect(target).toBeVisible();

  const before = await valueNow(target);
  await drag(page, target, DRAG_PX);

  await expect.poll(async () => valueNow(target)).toBeGreaterThan(before);
});

test('Plot: a real mouse drag moves the marker to the left (#107)', async ({ page }) => {
  await openPlayground(page);
  const target = marker(page, 'Plot', 'Static');
  await expect(target).toBeVisible();

  const before = await valueNow(target);
  await drag(page, target, -DRAG_PX);

  await expect.poll(async () => valueNow(target)).toBeLessThan(before);
});

test('KinematicsWidget: the time marker follows a real mouse drag (#107)', async ({ page }) => {
  await openPlayground(page);
  const target = marker(page, 'KinematicsWidget', 'Curriculum03');
  await expect(target).toBeVisible();

  const before = await valueNow(target);
  await drag(page, target, DRAG_PX);

  await expect.poll(async () => valueNow(target)).toBeGreaterThan(before);
});
