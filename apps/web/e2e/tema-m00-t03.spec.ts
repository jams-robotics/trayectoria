import { expect, test, type Page } from '@playwright/test';

// Bug #283: the three charts of the KinematicsWidget of m00-t03 grew without end and pushed the
// page sideways. uPlot pins a pixel width on its canvas that never shrinks back, and inside an
// elastic column that feeds back (docs/DESIGN.md §9.8). This checks that the page does not
// scroll horizontally and that every chart settles within its column, on desktop and on mobile,
// with the last label of its `t` axis on screen.
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
  /** Width of the card of the chart without its padding and border. */
  cardContent_px: number;
  /** Page x of the right edge of the last `t` tick label, or null when none is painted. */
  lastLabelRight_px: number | null;
  /** Page x of the right edge of the card's content box. */
  cardContentRight_px: number;
}

interface Layout {
  /** How far the document scrolls horizontally, in CSS pixels. */
  overflow_px: number;
  charts: ChartWidths[];
}

/**
 * Reads the horizontal overflow of the page and, per chart, the width of its canvas, of its
 * column and of its card's content, and where the last `t` tick label ends. uPlot paints the
 * labels on the canvas, so that edge comes from its pixels: from the bottom up, the first band
 * of painted rows is the axis title `t (s)` and the second one the tick labels.
 */
async function readLayout(page: Page): Promise<Layout> {
  return page.evaluate((selector) => {
    /** Rightmost painted column of each canvas row, in device pixels; -1 for an empty row. */
    const rightmostInk = (canvas: HTMLCanvasElement): number[] => {
      const { data } = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height) ?? {
        data: [],
      };
      return Array.from({ length: canvas.height }, (_, row) => {
        for (let column = canvas.width - 1; column >= 0; column -= 1) {
          if ((data[(row * canvas.width + column) * 4 + 3] ?? 0) > 0) return column;
        }
        return -1;
      });
    };
    /** Rightmost painted column of the second band of painted rows from the bottom. */
    const tickLabelsRight = (rows: number[]): number | null => {
      let band = 0;
      let right = -1;
      for (let row = rows.length - 1; row >= 0 && band <= 2; row -= 1) {
        const painted = (rows[row] ?? -1) >= 0;
        const previous = (rows[row + 1] ?? -1) >= 0;
        if (painted && !previous) band += 1;
        if (painted && band === 2) right = Math.max(right, rows[row] ?? -1);
      }
      return right < 0 ? null : right;
    };
    /** Widths and last-label edge of one chart's card and canvas. */
    const measureChart = (canvas: HTMLCanvasElement): ChartWidths => {
      const card = canvas.closest('figure') ?? canvas;
      const style = getComputedStyle(card);
      const cardBox = card.getBoundingClientRect();
      const canvasBox = canvas.getBoundingClientRect();
      const ratio = canvas.width / canvasBox.width;
      const labelsRight = tickLabelsRight(rightmostInk(canvas));
      return {
        canvas_px: canvasBox.width,
        column_px: card.parentElement?.getBoundingClientRect().width ?? 0,
        cardContent_px:
          card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        lastLabelRight_px: labelsRight === null ? null : canvasBox.left + labelsRight / ratio,
        cardContentRight_px:
          cardBox.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
      };
    };
    const root = document.documentElement;
    const canvases = document.querySelectorAll<HTMLCanvasElement>(selector);
    return {
      overflow_px: root.scrollWidth - root.clientWidth,
      charts: [...canvases].map(measureChart),
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
    for (const chart of settled.charts) {
      expect(chart.canvas_px).toBeLessThanOrEqual(chart.column_px);
      // The canvas used to take the card's padding too and spill past it (#283).
      expect(chart.canvas_px).toBeLessThanOrEqual(chart.cardContent_px);
      expect(chart.lastLabelRight_px).not.toBeNull();
      expect(chart.lastLabelRight_px ?? Infinity).toBeLessThanOrEqual(chart.cardContentRight_px);
    }
  });
}
