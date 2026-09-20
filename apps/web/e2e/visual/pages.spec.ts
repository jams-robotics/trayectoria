import { expect, test } from '@playwright/test';

// F5-01b (#134, decisión 5): regresión visual de las páginas de simulador. Capturas sobre WebGL,
// así que se comparan con `maxDiffPixelRatio`: el renderizado de three en Chromium headless no
// es idéntico píxel a píxel entre máquinas (mismo criterio que `ArmViewer` en `sims.spec.ts`).
// La escena no anima: no hay bucle de render más allá del que dispara la órbita.

/** Diferencia admitida en las capturas de WebGL, en fracción de píxeles del recorte. */
const WEBGL_MAX_DIFF_PIXEL_RATIO = 0.02;

/** Margen para la isla perezosa: su chunk arrastra three y urdf-loader. */
const ISLAND_TIMEOUT_MS = 30_000;

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const SHOTS = [
  { shot: 'sim-brazo', viewport: null },
  { shot: 'sim-brazo-390', viewport: MOBILE_VIEWPORT },
] as const;

for (const { shot, viewport } of SHOTS) {
  test(`${shot} looks as approved`, async ({ page }) => {
    if (viewport !== null) await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = 'astro-dev-toolbar { display: none !important; }';
      document.addEventListener('DOMContentLoaded', () => document.head.append(style));
    });
    await page.goto('/simuladores/brazo?robot=planar2dof');

    // El panel del efector con un número es la puerta de «el URDF ya cargó y sim-core resolvió
    // la pose», sin depender del canvas.
    await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
      timeout: ISLAND_TIMEOUT_MS,
    });
    await page.evaluate(() => document.fonts.ready);

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    // `preserveDrawingBuffer` mantiene el búfer más allá del fotograma en que se dibujó, así que
    // la captura lo recoge; leerlo aquí además fuerza la composición antes de la captura.
    await expect
      .poll(async () =>
        canvas.evaluate((element: HTMLCanvasElement) => {
          if (element.width === 0) return 0;
          const copy = document.createElement('canvas');
          copy.width = element.width;
          copy.height = element.height;
          const ctx = copy.getContext('2d');
          if (ctx === null) return 0;
          ctx.drawImage(element, 0, 0);
          const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
          let painted = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 0) painted += 1;
          }
          return painted;
        }),
      )
      .toBeGreaterThan(0);

    await expect(page).toHaveScreenshot(`${shot}.png`, {
      maxDiffPixelRatio: WEBGL_MAX_DIFF_PIXEL_RATIO,
      // Playwright repite la captura hasta que dos consecutivas coinciden: sobre WebGL eso puede
      // tardar más que el tiempo por defecto.
      timeout: ISLAND_TIMEOUT_MS,
    });
  });
}
