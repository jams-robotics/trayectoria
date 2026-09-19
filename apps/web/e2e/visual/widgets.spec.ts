import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F2-01a: visual regression of every widget section of the /dev/widgets playground.
// Light theme and the default viewport of the chromium project; no Supabase needed.
// `story` narrows the shot to one case: Plot animates in `Live` and `PlotStress`, so only the
// static case is comparable frame to frame (F2-01b, decision 8 of the assignment of #83).
const WIDGETS = [
  { name: 'ParamPanel' },
  { name: 'Formula' },
  { name: 'Plot', story: 'Static' },
] as const;

async function openPlayground(page: Page): Promise<void> {
  // With nothing stored, the inline script of Base.astro follows the system preference; the
  // snapshots are approved in the light theme (decision of the assignment comment of #82).
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/widgets');
  // The Astro dev toolbar floats over the page in `astro dev`; it is not part of any widget.
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  // Fonts settle before the screenshot, otherwise the fallback face is captured.
  await page.evaluate(() => document.fonts.ready);
}

for (const widget of WIDGETS) {
  const story = 'story' in widget ? widget.story : undefined;
  test(`${widget.name} looks as approved`, async ({ page }) => {
    await openPlayground(page);
    const section = page.locator(`[data-widget="${widget.name}"]`);
    const target = story === undefined ? section : section.locator(`[data-story="${story}"]`);
    await expect(target).toBeVisible();
    // Plot loads uPlot lazily (it needs a browser), so the canvas appears one tick after the
    // card: without this the shot would catch an empty chart area (F2-01b).
    if (widget.name === 'Plot') await expect(target.locator('canvas')).toBeVisible();
    await expect(target).toHaveScreenshot(`${widget.name}.png`);
  });
}

test('the playground renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await openPlayground(page);
  // Waiting for the element to be visible is not enough: a hydration mismatch discards and
  // re-renders the client tree asynchronously, after the initial paint (F2-01a, ronda 1). Wait
  // for the slider to actually respond to input, which only happens once React has attached its
  // event handlers post-hydration, before asserting no console/pageerror was raised.
  const slider = page.locator('[data-widget="ParamPanel"] input[type="range"]').first();
  await expect(slider).toBeVisible();
  const initialValue = await slider.inputValue();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).not.toHaveValue(initialValue);
  expect(errors).toEqual([]);
});
