import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// TEMP (#249): diagnóstico del fallo intermitente de sim-compartir.spec.ts:169. Se borra antes de
// pedir revisión. Mismo `open` que el spec; cambia solo la carga de la máquina.

async function open(page: Page): Promise<void> {
  await page.goto('/simuladores/movil');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('start-pose-s')).toBeVisible();
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
}

test('CPU x6: abrir la página deja un solo line-follower-t', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await open(page);
});

test('fotograma tardío: abrir la página deja un solo line-follower-t', async ({ page }) => {
  // Un runner cargado que tarda en dar el siguiente fotograma: el `$RC` de React revela los
  // segmentos del servidor en `requestAnimationFrame`.
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      window.setTimeout(() => raf(callback), 500);
      return 0;
    };
  });
  await open(page);
});
