import { expect, test } from '@playwright/test';

// v1.5: no two-column mode. On large windows the page container (`--size-site`, 1440 px at most)
// is what grows, so the Explora viewer is bigger and nothing inside `main` scrolls on its own.
test('a 1763 px el visor de Explora es mayor que a 1366 px y el tema no tiene scroll interno', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/ruta/ruta-1/m00/t01');
  const widget = page.locator('#explora [data-topic-widget]').first();
  await expect(widget.locator('canvas, svg').first()).toBeVisible();
  const viewerWidth = (): Promise<number> =>
    widget.evaluate((root) =>
      Math.max(
        ...[...root.querySelectorAll('canvas, svg')].map((c) => c.getBoundingClientRect().width),
      ),
    );
  const narrow = await viewerWidth();

  await page.setViewportSize({ width: 1763, height: 950 });
  await expect.poll(viewerWidth).toBeGreaterThan(narrow + 50);

  const article = (await page.locator('article[data-topic-article]').boundingBox())!;
  expect((await widget.boundingBox())!.width).toBeCloseTo(article.width, 0);
  const scrolling = await page.locator('main *').evaluateAll((elements) =>
    elements
      .filter((element) => {
        const { overflowX, overflowY } = getComputedStyle(element);
        return (
          (/auto|scroll/.test(overflowY) && element.scrollHeight > element.clientHeight + 1) ||
          (/auto|scroll/.test(overflowX) && element.scrollWidth > element.clientWidth + 1)
        );
      })
      .map((element) => `${element.tagName.toLowerCase()}.${element.className}`),
  );
  expect(scrolling).toEqual([]);
});
