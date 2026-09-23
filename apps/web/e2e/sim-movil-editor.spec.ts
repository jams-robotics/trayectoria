import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MOBILE_VIEWPORT, openEditor, openMobileSim as open, readout } from './sim-movil.helpers';

// #158 (decisiones 1-4): «Editar» abre el editor de pista en la caja del visor, con el mismo
// ancho que este y sin mover ni estrechar la columna de paneles; «Volver a la simulación»
// devuelve el visor y reinicia la simulación pausada en t = 0 con la pista editada.
//
// #189 (decisiones 2, 3 y 5): dentro de esa caja el lienzo es el protagonista —ocupa el ancho
// entero y no hay scroll interno— y el panel numérico del segmento se va a la columna derecha,
// que mientras se edita no muestra Controlador, Robot, Pista ni Gráficas.
test.describe('editor de pista en la caja del visor (#158, #189)', () => {
  /** Tolerancia de ancho entre el visor y el editor, en píxeles (decisión 4). */
  const WIDTH_TOLERANCE_PX = 2;

  /** Ancho de un elemento en píxeles, del recuadro que el navegador le da. */
  async function width_px(page: Page, testId: string): Promise<number> {
    const box = await page.getByTestId(testId).boundingBox();
    if (box === null) throw new Error(`no box for ${testId}`);
    return box.width;
  }

  test('«Editar» pone el editor en la caja del visor y «Volver» restaura el visor', async ({
    page,
  }) => {
    await open(page);

    const viewer_px = await width_px(page, 'line-follower-view');
    const columnLeft_px = (await page.getByTestId('panel-track').boundingBox())?.x ?? 0;

    await openEditor(page);
    // «Editar» está abajo en la columna y pulsarlo desplaza la página; las posiciones que siguen
    // se comparan desde arriba del documento, como la primera medida.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // El editor está en la caja del visor: el visor ya no se ve y el editor ocupa su sitio.
    const editorBox = page.getByTestId('track-editor-box');
    await expect(editorBox).toBeVisible();
    await expect(page.getByTestId('line-follower-view')).toBeHidden();

    // La caja sigue a la izquierda de la columna, que no se apila debajo (#158, decisión 1). La
    // columna sí cambia de ancho: con un solo panel dentro mide menos que con seis, y la caja se
    // queda con lo que aquella suelta (#189, decisión 2), que es justo el espacio que el lienzo
    // necesitaba.
    const box = await editorBox.boundingBox();
    const column = await page.getByTestId('sim-editor-column').boundingBox();
    if (box === null || column === null) throw new Error('no boxes');
    expect(column.x).toBeGreaterThan(box.x + box.width - WIDTH_TOLERANCE_PX);
    expect(column.y).toBeLessThan(box.y + box.height);
    expect(box.width).toBeGreaterThanOrEqual(viewer_px);
    expect(column.x).toBeGreaterThanOrEqual(columnLeft_px);

    // «Volver a la simulación» devuelve el visor a su caja, con el ancho que tenía, y retira el
    // editor y su columna.
    await page.getByTestId('track-editor-back').click();
    await expect(page.getByTestId('line-follower-view')).toBeVisible();
    await expect(editorBox).toHaveCount(0);
    expect(Math.abs((await width_px(page, 'line-follower-view')) - viewer_px)).toBeLessThanOrEqual(
      WIDTH_TOLERANCE_PX,
    );
    const columnLeftBack_px = (await page.getByTestId('panel-track').boundingBox())?.x ?? 0;
    expect(Math.abs(columnLeftBack_px - columnLeft_px)).toBeLessThanOrEqual(WIDTH_TOLERANCE_PX);
  });

  test('el lienzo llena la caja y no hay scroll interno (#189, decisiones 1 y 3)', async ({
    page,
  }) => {
    await open(page);
    await openEditor(page);

    const canvas = page.getByTestId('track-editor-box').locator('[data-testid="scene2d"] canvas');
    await expect(canvas).toBeVisible();

    // El lienzo mide lo que mide la caja: ni una columna de panel al lado ni margen que sobre.
    const box_px = await width_px(page, 'track-editor-box');
    const canvasBox = await canvas.boundingBox();
    if (canvasBox === null) throw new Error('no box for the canvas');
    expect(Math.abs(canvasBox.width - box_px)).toBeLessThanOrEqual(WIDTH_TOLERANCE_PX);

    // Y nada dentro de la caja se desplaza: ningún elemento con scroll propio desborda de su
    // altura (decisión 3). Se miran los que de verdad pueden desplazarse —`overflow` distinto de
    // `visible`—, no los que están fuera de la vista como el input de archivo de «Cargar».
    const overflow_px = await page.getByTestId('track-editor-box').evaluate((box) => {
      const scrollable = [box, ...box.querySelectorAll('*')].filter((element) => {
        const { overflowY } = getComputedStyle(element);
        return overflowY === 'auto' || overflowY === 'scroll';
      });
      return scrollable.reduce(
        (worst, element) => Math.max(worst, element.scrollHeight - element.clientHeight),
        0,
      );
    });
    expect(overflow_px).toBe(0);

    // La caja tampoco crece por dentro más de lo que mide: el editor cabe en ella.
    const fits_px = await page
      .getByTestId('track-editor-box')
      .evaluate((box) => box.scrollHeight - box.clientHeight);
    expect(fits_px).toBeLessThanOrEqual(WIDTH_TOLERANCE_PX);
  });

  test('el panel del segmento está en la columna derecha (#189, decisión 2)', async ({ page }) => {
    await open(page);
    await openEditor(page);

    // La columna derecha muestra el panel del editor y solo ese.
    const column = page.getByTestId('sim-editor-column');
    await expect(column).toBeVisible();
    await expect(column.getByTestId('track-editor-panel')).toBeVisible();
    for (const id of ['controller', 'robot', 'track', 'plots']) {
      await expect(page.getByTestId(`panel-${id}`)).toHaveCount(0);
    }
    // El panel no quedó dentro de la caja del editor: allí solo están la barra y el lienzo.
    await expect(
      page.getByTestId('track-editor-box').getByTestId('track-editor-panel'),
    ).toHaveCount(0);

    // Y al volver, los cuatro paneles están otra vez donde estaban.
    await page.getByTestId('track-editor-back').click();
    await expect(page.getByTestId('sim-editor-column')).toHaveCount(0);
    for (const id of ['controller', 'robot', 'track', 'plots']) {
      await expect(page.getByTestId(`panel-${id}`)).toBeVisible();
    }
  });

  test('a 390 px el panel del editor es un acordeón abierto (#189, decisión 2)', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await open(page);
    await openEditor(page);

    // Un solo acordeón en la columna, el del editor, y abierto: es lo único que la columna tiene.
    const accordions = page.getByTestId('sim-editor-column').getByTestId('sim-accordion');
    await expect(accordions).toHaveCount(1);
    await expect(accordions.getByRole('button', { name: /Segmento/ }).first()).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(page.getByTestId('track-editor-panel')).toBeVisible();

    // Al volver, los seis acordeones de la página están de nuevo.
    await page.getByTestId('track-editor-back').click();
    await expect(page.getByTestId('sim-accordion')).toHaveCount(6);
  });

  /**
   * Fraction of the canvas, from its top-right corner, where the stroke starts: the band the
   * floating segment bar took with any tool (#189, decision 4). With the bar reserved for
   * «Seleccionar» (#180, decision 1) that corner is canvas again.
   */
  const CORNER_INSET = 0.05;

  /** Fraction of the canvas width the stroke travels leftwards. */
  const STROKE_SPAN = 0.3;

  test('con «Recta» se dibuja desde la esquina superior derecha del lienzo (#180)', async ({
    page,
  }) => {
    await open(page);
    await openEditor(page);

    const canvas = page.getByTestId('track-editor-box').locator('[data-testid="scene2d"] canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error('no box for the canvas');

    // The opening track is the oval: whatever segments exist before the stroke are its own.
    const segments = page
      .getByTestId('track-editor-panel')
      .getByRole('list', { name: 'Segmentos de la pista' })
      .getByRole('button');
    const before = await segments.count();

    await page.getByRole('radio', { name: 'Recta' }).click();
    // The `pointerdown` lands on the corner the bar used to cover; were anything still floating
    // there, the stroke would not reach the canvas and no new segment would appear.
    const start = {
      x: box.x + box.width * (1 - CORNER_INSET),
      y: box.y + box.height * CORNER_INSET,
    };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x - box.width * STROKE_SPAN, start.y, { steps: 4 });
    await page.mouse.up();

    await expect(segments).toHaveCount(before + 1);
  });

  test('«Volver a la simulación» deja la simulación pausada en t = 0', async ({ page }) => {
    await open(page);

    // La simulación avanza antes de editar: si volviera sin reiniciar, `t` no sería 0.
    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(0.2);
    await page.getByRole('button', { name: 'Pausa' }).first().click();

    await page.getByTestId('track-source-edit').click();
    await expect(page.getByTestId('track-editor')).toBeVisible();
    await page.getByTestId('track-editor-back').click();

    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
    await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeDisabled();
  });
});
