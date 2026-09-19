import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F2-01a: visual regression of every widget section of the /dev/widgets playground.
// Light theme and the default viewport of the chromium project; no Supabase needed.
// `story` narrows the shot to one case: Plot animates in `Live` and `PlotStress`, so only the
// static case is comparable frame to frame (F2-01b, decision 8 of the assignment of #83).
// `shot` names the PNG when it is not the widget's own name (a second approved case).
const WIDGETS = [
  { name: 'ParamPanel' },
  { name: 'Formula' },
  { name: 'Plot', story: 'Static' },
  // Scene2D paints once per change with no continuous loop (F2-02a, decision 2 of the
  // assignment of #84), so the whole section is comparable frame to frame; `Primitives` is the
  // approved case of the ticket (grid, axes, two vectors, a trace, a circle, a rect, a label).
  { name: 'Scene2D', story: 'Primitives' },
  // The reference robot on the `oval` preset, captured paused at t = 0: the driver only advances
  // on «Reproducir», so the scene is static and comparable frame to frame (F2-02b, decision 6).
  { name: 'Scene2D', story: 'RobotOnTrack', shot: 'Scene2D-robot' },
  // SimControls is static too: the clock only moves while the simulation is running.
  { name: 'SimControls', story: 'Full', shot: 'SimControls' },
] as const;

/** Default width of a `<canvas>` with no `width` attribute yet; a scene past it has been sized. */
const INTRINSIC_CANVAS_WIDTH_PX = 300;

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
  const shot = 'shot' in widget ? widget.shot : widget.name;
  test(`${shot} looks as approved`, async ({ page }) => {
    await openPlayground(page);
    const section = page.locator(`[data-widget="${widget.name}"]`);
    const target = story === undefined ? section : section.locator(`[data-story="${story}"]`);
    await expect(target).toBeVisible();
    // Plot loads uPlot lazily (it needs a browser), so the canvas appears one tick after the
    // card: without this the shot would catch an empty chart area (F2-01b).
    if (widget.name === 'Plot') await expect(target.locator('canvas')).toBeVisible();
    // Scene2D measures its container with a `ResizeObserver` and then paints inside a
    // `requestAnimationFrame`, so the canvas is still at its intrinsic 300 x 150 and blank when
    // it first becomes visible: wait until it has been resized to its container and painted.
    if (widget.name === 'Scene2D') {
      const canvas = target.locator('canvas');
      await expect(canvas).toBeVisible();
      await expect
        .poll(async () =>
          canvas.evaluate((element: HTMLCanvasElement, intrinsicWidth_px: number) => {
            const ctx = element.getContext('2d');
            if (ctx === null || element.width <= intrinsicWidth_px) return 0;
            const { data } = ctx.getImageData(0, 0, element.width, element.height);
            let painted = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) painted += 1;
            }
            return painted;
          }, INTRINSIC_CANVAS_WIDTH_PX),
        )
        .toBeGreaterThan(0);
    }
    await expect(target).toHaveScreenshot(`${shot}.png`);
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
