import { expect, test } from '@playwright/test';

// F4-02b (#128, decisión 6): regresión visual de `/simuladores/movil` en escritorio y a 390 px.
// Sin WebGL en esta página — el visor es el `Scene2D` de canvas 2D —, así que las capturas se
// comparan sin tolerancia. La escena se captura pausada en `t = 0`: nada arranca solo.

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Margen para la isla perezosa: el simulador entra con un `import()` aparte. */
const ISLAND_TIMEOUT_MS = 30_000;

const SHOTS = [
  { shot: 'sim-movil', viewport: null },
  { shot: 'sim-movil-390', viewport: MOBILE_VIEWPORT },
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
    await page.goto('/simuladores/movil');

    // El reloj a cero es la puerta de «el modelo ya publicó su estado inicial», sin depender del
    // canvas y sin que nada haya avanzado la simulación.
    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s', {
      timeout: ISLAND_TIMEOUT_MS,
    });
    // El asa de la pose inicial aparece cuando el módulo del simulador ya resolvió la pose de
    // apertura: capturar antes dejaría fuera el marcador de la pista.
    await expect(page.getByTestId('start-pose-s')).toBeVisible();
    // La maqueta de móvil se decide tras montar (`matchMedia` no existe en el servidor), así que
    // la barra inferior es la puerta de «la isla ya está en la maqueta 08».
    if (viewport !== null) await expect(page.getByTestId('sim-bottom-bar')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot(`${shot}.png`, { timeout: ISLAND_TIMEOUT_MS });
  });
}
