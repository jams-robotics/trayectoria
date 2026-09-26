import { expect, test } from '@playwright/test';

// #380 / #386: the values panel of the sticky top row grows the row up to 50vh (docs/DESIGN.md
// §6, point 1) and only scrolls inside beyond that cap, never when it barely overflows the viewer.
const CASES = [
  { url: '/ruta/ruta-1/m00/t03', scrolls: false },
  { url: '/ruta/ruta-1/m01/t01', scrolls: false },
  { url: '/ruta/ruta-1/m03/t01', scrolls: false },
  { url: '/ruta/ruta-1/m02/t03', scrolls: true },
] as const;
const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;

for (const viewport of VIEWPORTS) {
  for (const { url, scrolls } of CASES) {
    test(`values panel of ${url} at ${viewport.width}x${viewport.height} ${scrolls ? 'scrolls' : 'does not scroll'}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(url);
      const box = page.locator('[data-sim-region="values"] > div').first();
      await expect(box).toBeVisible();
      const overflow_px = (): Promise<number> =>
        box.evaluate((element) => element.scrollHeight - element.clientHeight);
      if (scrolls) {
        await expect.poll(overflow_px).toBeGreaterThan(0);
        const height_px = await box.evaluate((element) => element.clientHeight);
        expect(height_px).toBeLessThanOrEqual(viewport.height / 2);
      } else {
        await expect.poll(overflow_px).toBe(0);
      }
    });
  }
}
