import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// Ayudas compartidas de los tests de `/simuladores/movil`: abrir la página ya asentada, leer las
// cifras del visor y llevar el editor a la caja del visor. Las usan `sim-movil.spec.ts` (#128,
// #158, #189) y `sim-movil-nueva.spec.ts` (#190), que las separa para que ningún archivo pase de
// las 300 líneas de docs/STANDARDS.md §4.

/** Mobile viewport of the mockups (docs/DESIGN.md §9). */
export const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Abre la página y espera a que la isla esté asentada: el asa de la pose inicial solo aparece
 * cuando el módulo del simulador ya resolvió la pose de apertura, y aplicarla reconstruye la
 * simulación. Reproducir antes de eso arrancaría una carrera que el propio reinicio detiene.
 */
export async function openMobileSim(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/simuladores/movil');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('start-pose-s')).toBeVisible();
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
}

/** Las lecturas que la página muestra, leídas en una sola evaluación del DOM. */
export interface Readout {
  readonly t: string;
  readonly x: string;
  readonly y: string;
  readonly theta: string;
}

/** Lee las lecturas del visor tal y como se ven. */
export async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => {
    const read = (id: string): string =>
      document.querySelector(`[data-testid="line-follower-${id}"]`)?.textContent ?? '';
    return { t: read('t'), x: read('x'), y: read('y'), theta: read('theta') };
  });
}

/**
 * Pulsa uno de los botones del editor en el panel Pista. A 390 px ese panel es un acordeón
 * cerrado, así que primero hay que abrirlo: el botón existe en el DOM pero no se ve
 * (docs/DESIGN.md §9.4).
 */
export async function openEditor(page: Page, testId = 'track-source-edit'): Promise<void> {
  const button = page.getByTestId(testId);
  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: /^Pista/ }).click();
  }
  await button.click();
  await expect(page.getByTestId('track-editor')).toBeVisible();
}
