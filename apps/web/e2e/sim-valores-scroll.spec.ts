import { expect, test } from '@playwright/test';

// #380 / #386: the values panel of the sticky top row grows the row up to 50vh (docs/DESIGN.md
// §6, point 1) and only scrolls inside beyond that cap, never when it barely overflows the viewer.
// Since 1.5 the panels fold their extra rows behind «Más datos», so no topic overflows the cap when
// it loads: the gear train of ruta-1/m02/t04, the longest one, is only checked against the cap.
type Expect = 'scroll' | 'none' | 'capped';
const CASES: ReadonlyArray<{ url: string; at1280: Expect; at1440: Expect }> = [
  { url: '/ruta/ruta-1/m00/t03', at1280: 'none', at1440: 'none' },
  { url: '/ruta/ruta-1/m01/t01', at1280: 'none', at1440: 'none' },
  { url: '/ruta/ruta-1/m03/t01', at1280: 'none', at1440: 'none' },
  { url: '/ruta/ruta-1/m02/t04', at1280: 'capped', at1440: 'capped' },
];
const VIEWPORTS = [
  { width: 1280, height: 800, key: 'at1280' },
  { width: 1440, height: 900, key: 'at1440' },
] as const;

for (const { key, ...viewport } of VIEWPORTS) {
  for (const test_case of CASES) {
    const expected = test_case[key];
    const url = test_case.url;
    test(`values panel of ${url} at ${viewport.width}x${viewport.height}: ${expected}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.goto(url);
      const box = page.locator('[data-sim-region="values"] > div').first();
      await expect(box).toBeVisible();
      const overflow_px = (): Promise<number> =>
        box.evaluate((element) => element.scrollHeight - element.clientHeight);
      if (expected === 'none') {
        await expect.poll(overflow_px).toBe(0);
        return;
      }
      if (expected === 'scroll') await expect.poll(overflow_px).toBeGreaterThan(0);
      const height_px = await box.evaluate((element) => element.clientHeight);
      expect(height_px).toBeLessThanOrEqual(viewport.height / 2);
    });
  }
}
