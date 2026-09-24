import { expect, test, type Page } from '@playwright/test';

// Bug #283: the three charts of the KinematicsWidget of m00-t03 grew without end and pushed the
// page sideways. uPlot pins a pixel width on its canvas that never shrinks back, and inside an
// elastic column that feeds back (docs/DESIGN.md §9.8). This checks that the page does not
// scroll horizontally and that every chart settles within its column, on desktop and on mobile.
const TOPIC_URL = '/ruta/ruta-1/m00/t03';
/** The uPlot canvases of the widget, one per chart. */
const CANVAS_SELECTOR = '[data-topic-widget="KinematicsWidget"] [data-testid="plot-canvas"] canvas';
/** Charts of the widget: `x–t`, `v–t` and `a–t`. */
const CHART_COUNT = 3;
/** Time a settled layout must hold still, in milliseconds (criterion of #283). */
const SETTLE_MS = 2000;
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

interface ChartWidths {
  canvas_px: number;
  column_px: number;
}

interface Layout {
  /** How far the document scrolls horizontally, in CSS pixels. */
  overflow_px: number;
  charts: ChartWidths[];
}

/** Reads the horizontal overflow of the page and the width of each chart and of its column. */
async function readLayout(page: Page): Promise<Layout> {
  return page.evaluate((selector) => {
    const root = document.documentElement;
    const canvases = document.querySelectorAll(selector);
    return {
      overflow_px: root.scrollWidth - root.clientWidth,
      charts: [...canvases].map((canvas) => ({
        canvas_px: canvas.getBoundingClientRect().width,
        column_px: canvas.closest('figure')?.parentElement?.getBoundingClientRect().width ?? 0,
      })),
    };
  }, CANVAS_SELECTOR);
}

for (const viewport of VIEWPORTS) {
  test(`m00-t03 charts settle within their column (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(TOPIC_URL);
    await expect(page.locator(CANVAS_SELECTOR)).toHaveCount(CHART_COUNT);

    const loaded = await readLayout(page);
    await page.waitForTimeout(SETTLE_MS);
    const settled = await readLayout(page);

    // A chart that keeps re-measuring is torn down and rebuilt, so it can be missing mid-read.
    expect(loaded.charts).toHaveLength(CHART_COUNT);
    expect(settled.charts).toHaveLength(CHART_COUNT);
    expect(settled.overflow_px).toBeLessThanOrEqual(0);
    expect(settled.charts.map(({ canvas_px }) => canvas_px)).toEqual(
      loaded.charts.map(({ canvas_px }) => canvas_px),
    );
    for (const { canvas_px, column_px } of settled.charts) {
      expect(canvas_px).toBeLessThanOrEqual(column_px);
    }
  });
}
