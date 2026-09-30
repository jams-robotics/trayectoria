import { expect, test } from '@playwright/test';

// QA of #378: in the «Explora» of Free fall (ProjectileWidget, drop A|B) moving the height of B
// changed the aspect of the scene, so the sticky top row grew and the page jumped. The scene now
// sits in a fixed box (docs/DESIGN.md §6, point 4): moving the last slider must not change the
// height of the row nor the height and scroll of the page. Free fall is in the reserve since #574
// (not published), so the check runs on the same drop A|B story of the widget playground.
const PAGE_URL = '/dev/widgets?section=ProjectileWidget';
const WIDGET = '[data-widget="ProjectileWidget"] [data-story="Drop"]';
/** Arrow presses on the last slider; each one raises the drop B by one step. */
const PRESSES = 5;

interface Layout {
  row_px: number;
  page_px: number;
  scroll_px: number;
}

test('moving the last slider of the drop A|B keeps the sticky row and the page still', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAGE_URL);
  const widget = page.locator(WIDGET).first();
  const row = widget.locator('[data-sim-row="top"]');
  await expect(row).toBeVisible();
  const last = widget.locator('[data-sim-region="params"] input[type="range"]').last();
  await last.focus();
  const layout = (): Promise<Layout> =>
    row.evaluate((element) => ({
      row_px: element.getBoundingClientRect().height,
      page_px: document.documentElement.scrollHeight,
      scroll_px: window.scrollY,
    }));
  const before = await layout();
  const value = await last.inputValue();
  for (let i = 0; i < PRESSES; i += 1) await page.keyboard.press('ArrowRight');
  await expect(last).not.toHaveValue(value);
  const after = await layout();
  expect(after.row_px).toBeCloseTo(before.row_px, 0);
  expect(after.page_px).toBe(before.page_px);
  expect(after.scroll_px).toBe(before.scroll_px);
});
