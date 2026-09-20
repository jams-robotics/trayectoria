import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { openEditor, openMobileSim as open, readout } from './sim-movil.helpers';

// #190 (decisiones 3 y 4): el panel Pista ofrece «Editar esta pista» y «Nueva pista». El primero
// abre el editor con la pista que se está simulando; el segundo, con el lienzo en blanco, y
// volver de él sin dibujar nada conserva la pista anterior y lo dice.
test.describe('«Nueva pista» y «Editar esta pista» (#190)', () => {
  /** Los segmentos que el panel del editor lista (los de la pista que tiene abierta). */
  function segments(page: Page) {
    return page.getByTestId('track-editor-panel').getByRole('button', { name: /^Segmento \d+: / });
  }

  test('«Nueva pista» abre el editor sin segmentos', async ({ page }) => {
    await open(page);
    await openEditor(page, 'track-source-new');

    // El lienzo está en blanco: ni un segmento en la lista, y la pista no cierra.
    await expect(segments(page)).toHaveCount(0);
    await expect(page.getByTestId('track-editor-continuity')).toContainText('Pista abierta');
  });

  test('«Editar esta pista» abre el editor con la pista actual', async ({ page }) => {
    await open(page);
    await openEditor(page, 'track-source-edit');

    // El óvalo de apertura llega entero al editor, que lo declara continuo y cerrado.
    await expect(segments(page).first()).toBeVisible();
    expect(await segments(page).count()).toBeGreaterThan(0);
    await expect(page.getByTestId('track-editor-continuity')).toContainText('Pista continua');
  });

  test('volver con el lienzo vacío conserva la pista anterior y avisa', async ({ page }) => {
    await open(page);
    await openEditor(page, 'track-source-new');
    await expect(segments(page)).toHaveCount(0);

    await page.getByTestId('track-editor-back').click();

    // El aviso de docs/DESIGN.md §5 y la pista de antes, que sigue ahí: el visor vuelve a verse y
    // la simulación arranca sobre ella, no sobre un lienzo sin línea.
    await expect(page.getByTestId('toast')).toContainText('se conserva la pista anterior');
    await expect(page.getByTestId('line-follower-view')).toBeVisible();
    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(0.2);
    // Sobre una pista de verdad el robot no pierde la línea nada más arrancar.
    await expect(page.getByTestId('line-follower-lost')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pausa' }).first().click();
  });
});
