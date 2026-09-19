import { expect, test } from '@playwright/test';

// F5-05: visual regression of the arm catalog. Both pages are static (no islands, no canvas,
// no clock), so they are comparable frame to frame. No Supabase needed.
const PAGES = [
  { path: '/brazos', shot: 'brazos' },
  { path: '/brazos/so101', shot: 'brazos-so101' },
];

for (const { path, shot } of PAGES) {
  test(`${path} matches its approved capture`, async ({ page }) => {
    // With nothing stored, the inline script of Base.astro follows the system preference; the
    // snapshots are approved in the light theme, as the rest of the visual suite.
    await page.emulateMedia({ colorScheme: 'light' });
    // The Astro dev toolbar floats over the page in `astro dev` and mounts on its own schedule,
    // so the rule is installed before any script of the page runs, not after the load.
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar { display: none !important; }';
      document.addEventListener('DOMContentLoaded', () => document.head.append(style));
    });
    await page.goto(path);
    // The photos are bundled assets: wait for them so the shot never catches an empty frame.
    await expect(page.locator('img').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    // Fonts settle before the screenshot, otherwise the fallback face is captured.
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${shot}.png`, { fullPage: true });
  });
}
