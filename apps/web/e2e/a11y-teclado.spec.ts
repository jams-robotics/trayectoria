import { expect, test, type Locator, type Page } from '@playwright/test';

// F7-01 (#432): keyboard, visible focus, accessible names and textual scene summaries on the five
// representative pages. The axe run of the same acceptance criterion waits for #434.
const PAGES = [
  { url: '/', ready: (page: Page) => page.getByRole('heading', { level: 1 }) },
  { url: '/ruta/ruta-1/m05/t02', ready: (page: Page) => page.getByTestId('scene2d') },
  { url: '/simuladores/movil', ready: (page: Page) => page.getByTestId('line-follower-view') },
  { url: '/simuladores/brazo', ready: (page: Page) => page.getByTestId('scene3d') },
  { url: '/cuenta', ready: (page: Page) => page.getByRole('heading', { level: 1 }) },
] as const;

/** Upper bound of tab stops walked per page, well above the longest page (≈55). */
const MAX_TAB_STOPS = 150;
/** Margin around the focused element so an `outline-offset` ring falls inside the capture. */
const RING_MARGIN_PX = 6;
const SEEN = 'data-a11y-seen';

async function open(page: Page, entry: (typeof PAGES)[number]): Promise<void> {
  await page.goto(entry.url);
  // The islands are `client:only`: the controls exist once React mounts them.
  await expect(entry.ready(page).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

/** Screenshot of the focused element and its surroundings, where a focus ring would be drawn. */
async function captureAround(page: Page, focused: Locator): Promise<Buffer | null> {
  const box = await focused.boundingBox();
  if (box === null || box.width === 0 || box.height === 0) return null;
  return page.screenshot({
    clip: {
      x: Math.max(box.x - RING_MARGIN_PX, 0),
      y: Math.max(box.y - RING_MARGIN_PX, 0),
      width: box.width + 2 * RING_MARGIN_PX,
      height: box.height + 2 * RING_MARGIN_PX,
    },
  });
}

/** Description of the focused element for the failure messages. */
function describe(focused: Locator): Promise<string> {
  return focused.evaluate((el) => el.outerHTML.slice(0, 120));
}

for (const entry of PAGES) {
  test(`${entry.url}: every tab stop has a name and a visible focus`, async ({ page }) => {
    test.setTimeout(120_000);
    await open(page, entry);
    const invisible: string[] = [];
    let stops = 0;
    for (; stops < MAX_TAB_STOPS; stops += 1) {
      await page.keyboard.press('Tab');
      const active = page.locator(':focus').first();
      if ((await active.count()) === 0) break;
      // The Astro dev toolbar only exists under `astro dev`; the page ends before it.
      if (
        await active.evaluate(
          (el, seen) => el.closest('astro-dev-toolbar') !== null || el.hasAttribute(seen),
          SEEN,
        )
      )
        break;
      // A handle that survives the blur below, when `:focus` no longer matches the element.
      await active.evaluate((el, stop) => el.setAttribute('data-a11y-seen', stop), `${stops}`);
      const focused = page.locator(`[${SEEN}="${stops}"]`);
      await focused.scrollIntoViewIfNeeded();
      await expect(focused, await describe(focused)).toHaveAccessibleName(/\S/);
      const withFocus = await captureAround(page, focused);
      await focused.evaluate((el) => (el as HTMLElement).blur());
      const withoutFocus = await captureAround(page, focused);
      if (withFocus === null || withoutFocus === null || withFocus.equals(withoutFocus)) {
        invisible.push(await describe(focused));
      }
      await focused.evaluate((el) => (el as HTMLElement).focus());
    }
    expect(stops).toBeGreaterThan(0);
    expect(stops).toBeLessThan(MAX_TAB_STOPS);
    expect(invisible).toEqual([]);
  });
}

/** Moves the focus with Tab until `target` has it, as a keyboard user would reach it. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('the control is not reachable with Tab');
}

test('/simuladores/movil: play, a slider and a toggle work from the keyboard', async ({ page }) => {
  await open(page, PAGES[2]);
  const play = page.getByRole('button', { name: 'Reproducir' });
  await tabTo(page, play);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Pausa' })).toBeVisible();
  await page.keyboard.press('Enter');

  const kp = page.getByRole('slider', { name: /^Kp/ });
  await tabTo(page, kp);
  const before = Number(await kp.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(async () => Number(await kp.getAttribute('aria-valuenow')))
    .toBeLessThan(before);

  const pid = page.getByRole('button', { name: 'PID', exact: true });
  await pid.focus();
  await page.keyboard.press('Space');
  await expect(pid).toHaveAttribute('aria-pressed', 'true');
});

test('/ruta/ruta-1/m05/t02: the robot handle moves with the arrows', async ({ page }) => {
  await open(page, PAGES[1]);
  const handle = page.getByTestId('scene-overlay').getByRole('button');
  const summary = page.getByRole('status').filter({ hasText: /El robot está en/ });
  const before = await summary.textContent();
  await tabTo(page, handle);
  await page.keyboard.press('ArrowRight');
  // The summary is refreshed at most every two seconds (docs/WIDGETS.md, reglas comunes).
  await expect(summary).not.toHaveText(before ?? '', { timeout: 5_000 });
});

test('/simuladores/brazo: a joint slider moves with the arrows', async ({ page }) => {
  await open(page, PAGES[3]);
  const joint = page.getByRole('slider').first();
  await tabTo(page, joint);
  const before = Number(await joint.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(async () => Number(await joint.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before);
});

for (const entry of PAGES.slice(1, 4)) {
  test(`${entry.url}: each scene has a description and a textual status`, async ({ page }) => {
    await open(page, entry);
    const described = page.locator('[role="img"]:has(canvas), canvas[role="img"]');
    await expect(described.first()).toBeVisible();
    for (const scene of await described.all()) {
      await expect(scene).toHaveAttribute('aria-label', /\S/);
    }
    await expect(page.locator('[role="status"][aria-live="polite"]').first()).toHaveText(/\S/);
  });
}
