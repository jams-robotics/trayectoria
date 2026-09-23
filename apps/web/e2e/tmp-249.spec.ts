import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// TEMP (#249): diagnóstico del fallo intermitente de sim-compartir.spec.ts:169. Se borra antes de
// pedir revisión. Mismo `open` que el spec.
//
// El runtime de React en el HTML del servidor revela los segmentos (`<div hidden id="r2S:0">`)
// con `$RC`: si el primer fotograma ya pasó (`$RT` es un número), no los revela en ese fotograma
// sino con un `setTimeout` de ~300 ms. Aquí se fija `$RT` para forzar ese camino.

async function open(page: Page): Promise<void> {
  await page.goto('/simuladores/movil');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('start-pose-s')).toBeVisible();
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
}

test('primer fotograma antes de $RC: un solo line-follower-t', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { $RT: number }).$RT = performance.now();
  });
  await open(page);
});

test('revelado retrasado 1,5 s: un solo line-follower-t', async ({ page }) => {
  await page.addInitScript(() => {
    const firstPaint = performance.now() + 1200;
    Object.defineProperty(window, '$RT', {
      configurable: true,
      get: () => firstPaint,
      set: () => undefined,
    });
  });
  await open(page);
});
