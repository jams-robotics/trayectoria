import { expect, test } from '@playwright/test';

// #648: visual regression of the home page at 1280 and 390 px. The demo of the hero runs with
// `prefers-reduced-motion`, so it stays on its first frame and the capture is stable.

const DEMO_TIMEOUT_MS = 30_000;

const SHOTS = [
  { shot: 'inicio', viewport: { width: 1280, height: 900 } },
  { shot: 'inicio-390', viewport: { width: 390, height: 844 } },
] as const;

for (const { shot, viewport } of SHOTS) {
  test(`${shot} looks as approved`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar { display: none !important; }';
      document.addEventListener('DOMContentLoaded', () => document.head.append(style));
    });
    await page.goto('/');
    await expect(page.getByTestId('home-demo').locator('canvas').first()).toBeVisible({
      timeout: DEMO_TIMEOUT_MS,
    });
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${shot}.png`, { fullPage: true });
  });
}
