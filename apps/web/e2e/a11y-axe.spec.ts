import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// F7-01 (#432, #434): axe on the five representative pages; the run fails on any `critical` or
// `serious` violation. Keyboard and focus are covered by a11y-teclado.spec.ts.
const PAGES = [
  { url: '/', ready: (page: Page) => page.getByRole('heading', { level: 1 }) },
  { url: '/ruta/ruta-1/m00/t01/', ready: (page: Page) => page.getByRole('heading', { level: 1 }) },
  { url: '/simuladores/movil/', ready: (page: Page) => page.getByTestId('line-follower-view') },
  { url: '/simuladores/brazo/', ready: (page: Page) => page.getByTestId('scene3d') },
  { url: '/cuenta/', ready: (page: Page) => page.getByRole('heading', { level: 1 }) },
] as const;

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

for (const entry of PAGES) {
  test(`${entry.url}: axe finds no critical or serious violations`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(entry.url);
    // The islands are `client:only`: their markup exists once React mounts them.
    await expect(entry.ready(page).first()).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    // The Astro dev toolbar only exists under `astro dev` and is not part of the site.
    const results = await new AxeBuilder({ page }).exclude('astro-dev-toolbar').analyze();
    const blocking = results.violations
      .filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.join(' ')),
      }));
    expect(blocking).toEqual([]);
  });
}
