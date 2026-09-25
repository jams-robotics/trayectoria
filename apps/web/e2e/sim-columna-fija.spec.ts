import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// #375 (docs/DESIGN.md, "Páginas de simulador"): on desktop the left column of both simulator
// pages (viewer plus «Gráficas» or the matrices panel) is sticky and scrolls inside; at 390 px
// nothing changes. No Supabase needed: both pages are static.

/** Margin for the lazy islands (the arm one pulls three and urdf-loader). */
const ISLAND_TIMEOUT_MS = 30_000;

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Computed `position` and `max-height` of an element. */
async function layoutOf(
  page: Page,
  testId: string,
): Promise<{ position: string; maxHeight: string }> {
  return page.getByTestId(testId).evaluate((element) => {
    const style = getComputedStyle(element);
    return { position: style.position, maxHeight: style.maxHeight };
  });
}

async function openMobileSim(page: Page): Promise<void> {
  await page.goto('/simuladores/movil');
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s', {
    timeout: ISLAND_TIMEOUT_MS,
  });
}

async function openArmWithMatrices(page: Page): Promise<void> {
  await page.goto('/simuladores/brazo?robot=planar2dof');
  await expect(page.getByTestId('arm-viewer')).toBeVisible({ timeout: ISLAND_TIMEOUT_MS });
  await page.getByTestId('matrices-toggle').click();
  await expect(page.getByTestId('matrix-panel')).toBeVisible({ timeout: ISLAND_TIMEOUT_MS });
}

test.describe('desktop', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  test('mobile sim: «Gráficas» sits under the viewer in a sticky left column', async ({ page }) => {
    await openMobileSim(page);
    const left = page.getByTestId('sim-left-column');
    await expect(left.getByTestId('panel-plots')).toBeVisible();
    expect(await layoutOf(page, 'sim-left-column')).toEqual({
      position: 'sticky',
      maxHeight: `${String(DESKTOP_VIEWPORT.height)}px`,
    });
    // The rest of the controls stay in the right column.
    await expect(left.getByTestId('panel-robot')).toHaveCount(0);
  });

  test('arm sim: the matrices panel sits under the scene in a sticky left column', async ({
    page,
  }) => {
    await openArmWithMatrices(page);
    const left = page.getByTestId('arm-viewer-left');
    await expect(left.getByTestId('matrix-panel')).toBeVisible();
    await expect(left.getByTestId('joint-sliders')).toHaveCount(0);
    expect(await layoutOf(page, 'arm-viewer-left')).toEqual({
      position: 'sticky',
      maxHeight: `${String(DESKTOP_VIEWPORT.height)}px`,
    });
  });

  test('no sticky column in a window under 640 px tall', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await openMobileSim(page);
    expect((await layoutOf(page, 'sim-left-column')).position).toBe('static');
  });
});

test.describe('390 px', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('mobile sim: «Gráficas» stays among the accordions, no sticky', async ({ page }) => {
    await openMobileSim(page);
    await expect(page.getByTestId('sim-bottom-bar')).toBeVisible();
    expect((await layoutOf(page, 'sim-left-column')).position).toBe('static');
    await expect(page.getByTestId('sim-left-column').getByTestId('panel-plots')).toHaveCount(0);
  });

  test('arm sim: one column, no sticky, the matrices panel outside the scene column', async ({
    page,
  }) => {
    await page.goto('/simuladores/brazo?robot=planar2dof');
    await expect(page.getByTestId('arm-viewer')).toBeVisible({ timeout: ISLAND_TIMEOUT_MS });
    // On mobile the view controls are folded: open them to reach the toggle.
    await page.locator('[data-testid="sim-accordion"] button[aria-expanded]').first().click();
    await page.getByTestId('matrices-toggle').click();
    await expect(page.getByTestId('matrix-panel')).toHaveCount(1);
    await expect(page.getByTestId('arm-viewer')).toHaveAttribute('data-split', 'false');
    await expect(page.getByTestId('arm-viewer-left').getByTestId('matrix-panel')).toHaveCount(0);
    expect((await layoutOf(page, 'arm-viewer-left')).position).toBe('static');
  });
});
