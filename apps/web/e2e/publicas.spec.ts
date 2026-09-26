import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };

// F7-05: the four public pages load with one h1 and no console errors, and the footer links
// lead to /contribuir and /acerca. axe runs on the three new pages (/ is in a11y-axe.spec.ts).
const PAGES = [
  { path: '/', h1: common.home.headline },
  { path: '/docentes', h1: common.teachersPage.title },
  { path: '/contribuir', h1: common.contributePage.title },
  { path: '/acerca', h1: common.aboutPage.title },
] as const;

for (const { path, h1 } of PAGES) {
  test(`${path} loads with its h1 and no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);

    if (path === '/') return;
    // The Astro dev toolbar only exists under `astro dev` and is not part of the site.
    const results = await new AxeBuilder({ page }).exclude('astro-dev-toolbar').analyze();
    const blocking = results.violations
      .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
      .map((violation) => violation.id);
    expect(blocking).toEqual([]);
  });
}

test('footer links lead to /contribuir and /acerca', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');

  await footer.getByRole('link', { name: common.footer.contribute }).click();
  await expect(page).toHaveURL(/\/contribuir\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(common.contributePage.title);

  await page.getByRole('contentinfo').getByRole('link', { name: common.footer.about }).click();
  await expect(page).toHaveURL(/\/acerca\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(common.aboutPage.title);
});
