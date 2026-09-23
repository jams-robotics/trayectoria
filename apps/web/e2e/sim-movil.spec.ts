import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { MOBILE_VIEWPORT, openMobileSim as open, readout } from './sim-movil.helpers';
import type { Readout } from './sim-movil.helpers';

// F4-02b (#128, decisión 6): la página `/simuladores/movil`. Sin Supabase: el selector de robots
// guardados no entra aquí (lo cubre el test unitario de la consulta con cliente mockeado); lo que
// se prueba es la vuelta completa con el preset óvalo y el PID por defecto, el determinismo de
// dos cargas y la maqueta de 390 px.
//
// El determinismo se comprueba con pulsaciones de «Paso» y no sobre el instante en que el
// contador de vueltas pasa a 1 (spec gap #155, resuelto): «Reproducir» integra en cada fotograma
// el tiempo real transcurrido en pasos enteros de `dt_s`, así que el estado publicado al cruzar
// la salida depende del reparto de fotogramas de la máquina. Un número fijo de pasos, en cambio,
// es el mismo número de `model.step()` en cualquier parte, y el estado que sale es exacto.

/** Tiempo simulado máximo admitido para la primera vuelta, en segundos (el modelo tarda ≈ 8,6 s). */
const LAP_LIMIT_S = 60;

/** Margen real para que la vuelta se complete a velocidad 4×, en milisegundos. */
const LAP_TIMEOUT_MS = 30_000;

/** Pulsaciones de «Paso» de la comprobación de determinismo (#155: «por ejemplo 200»). */
const DETERMINISM_STEPS = 200;

/**
 * Pone la velocidad al máximo, reproduce y devuelve el `t` simulado de la primera vuelta. El
 * modelo es determinista en tiempo simulado, pero el bucle de fotogramas avanza un número
 * distinto de pasos por fotograma según la máquina: el `t` que importa es el del estado en el
 * que el contador pasó a 1, no el del instante real en que el test mira. Por eso el par
 * `(vueltas, t)` se lee en la misma evaluación del DOM.
 */
async function runOneLap(page: Page): Promise<string> {
  await page.getByRole('combobox', { name: 'Velocidad de reproducción' }).selectOption('4');
  await page.getByRole('button', { name: 'Reproducir' }).first().click();

  let lap_s = '';
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const read = (id: string): string =>
            document.querySelector(`[data-testid="line-follower-${id}"]`)?.textContent ?? '';
          return `${read('laps')}|${read('t')}`;
        }),
      { timeout: LAP_TIMEOUT_MS },
    )
    .toMatch(/^1\|/);
  const pair = await page.evaluate(() => {
    const read = (id: string): string =>
      document.querySelector(`[data-testid="line-follower-${id}"]`)?.textContent ?? '';
    return `${read('laps')}|${read('t')}`;
  });
  lap_s = pair.split('|')[1] ?? '';
  await page.getByRole('button', { name: 'Pausa' }).first().click();
  return lap_s;
}

/**
 * Pulsa «Paso» `steps` veces y devuelve el estado resultante. «Paso» avanza exactamente un
 * `dt_s` por pulsación sin arrancar el bucle de fotogramas, así que dos cargas que reciben el
 * mismo número de pulsaciones pasan por la misma secuencia de estados (#155).
 *
 * Las pulsaciones se despachan dentro de la página y no con `locator.click()` una a una: son
 * cientos, y el ida y vuelta del protocolo por cada una agota el tiempo del test sin probar
 * nada más. El botón es el de verdad y el evento es el que React escucha; lo que se ahorra es
 * la comprobación de accionabilidad, que la primera pulsación ya deja verificada.
 */
async function stepAndRead(page: Page, steps: number): Promise<Readout> {
  const step = page.getByRole('button', { name: 'Paso' });
  await expect(step).toBeEnabled();
  await step.click();
  await page.evaluate((remaining) => {
    const buttons = [...document.querySelectorAll('button')];
    const button = buttons.find((candidate) => candidate.textContent?.trim() === 'Paso');
    if (button === undefined) throw new Error('no «Paso» button');
    for (let k = 0; k < remaining; k += 1) button.click();
  }, steps - 1);
  // «Paso» no pone la simulación en marcha: nada la sigue avanzando mientras se leen las cifras.
  await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeDisabled();
  return readout(page);
}

test.describe('/simuladores/movil (F4-02b)', () => {
  test('el PID por defecto completa una vuelta sin perder la línea', async ({ page }) => {
    await open(page);

    // El preset de apertura es el óvalo y el controlador el PID: los valores por defecto de la
    // página, que es lo que pide el criterio.
    await expect(page.getByTestId('track-source-select')).toHaveValue('oval');
    await expect(page.getByRole('button', { name: 'PID', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const time = await runOneLap(page);
    expect(Number.parseFloat(time)).toBeLessThanOrEqual(LAP_LIMIT_S);
    // El aviso de línea perdida no aparece en ningún momento de la vuelta.
    await expect(page.getByTestId('line-follower-lost')).toHaveCount(0);
  });

  test('dos cargas con los mismos parámetros muestran el mismo estado tras N pasos', async ({
    page,
  }) => {
    await open(page);
    const first = await stepAndRead(page, DETERMINISM_STEPS);

    await open(page);
    const second = await stepAndRead(page, DETERMINISM_STEPS);

    // Igualdad exacta, sin tolerancia: el mismo número de pasos sobre el mismo modelo, la misma
    // semilla y la misma pose inicial produce los mismos estados (#155).
    expect(second).toEqual(first);
    // Y los pasos han avanzado de verdad: un estado congelado en el arranque también sería igual.
    expect(Number.parseFloat(first.t)).toBeGreaterThan(0);
    expect(first).not.toMatchObject({ x: '0.000 m', y: '0.000 m' });
  });

  test('mover un slider en marcha no pausa ni reinicia la simulación (#161)', async ({ page }) => {
    await open(page);

    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    // La carrera ya avanza antes de tocar nada: si `t` siguiera en 0, el resto no probaría nada.
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(0.2);

    const before_s = Number.parseFloat((await readout(page)).t);

    // Kp con el teclado, que es como se mueve un slider de verdad: el valor cambia de hecho.
    const kp = page.getByRole('slider', { name: /^Kp/ });
    const kpBefore = await kp.inputValue();
    await kp.press('ArrowLeft');
    await expect(kp).not.toHaveValue(kpBefore);

    // Sigue en marcha — «Pausa» habilitado y «Reproducir» no — y el tiempo no ha vuelto a 0.
    await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeEnabled();
    const after_s = Number.parseFloat((await readout(page)).t);
    expect(after_s).toBeGreaterThanOrEqual(before_s);

    // Y el reloj sigue corriendo después del cambio, sin tocar «Reproducir» ni «Reiniciar».
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(after_s);

    await page.getByRole('button', { name: 'Pausa' }).first().click();
  });

  test('cambiar la velocidad de reproducción en marcha no pausa (#161)', async ({ page }) => {
    await open(page);

    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(0.2);

    await page.getByRole('combobox', { name: 'Velocidad de reproducción' }).selectOption('4');

    const after_s = Number.parseFloat((await readout(page)).t);
    await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeEnabled();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(after_s);

    await page.getByRole('button', { name: 'Pausa' }).first().click();
  });

  test('cambiar de controlador deja t = 0 y «Reproducir» arranca sin Reiniciar (#161)', async ({
    page,
  }) => {
    await open(page);

    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(0.2);

    await page.getByRole('button', { name: 'P', exact: true }).click();

    // Reinicio a t = 0 y en pausa.
    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
    await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeDisabled();

    // «Reproducir» basta: no hace falta «Reiniciar» antes.
    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t))
      .toBeGreaterThan(0.2);

    await page.getByRole('button', { name: 'Pausa' }).first().click();
  });

  test('a 390 px los paneles son acordeones, hay barra inferior y no hay «Paso»', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await open(page);

    // Robot, Pista, Controlador, Lecturas, Gráficas (F4-03) y «Guardar y compartir» (F4-05)
    // pasan a acordeones (docs/DESIGN.md §9 punto 8).
    await expect(page.getByTestId('sim-accordion')).toHaveCount(6);
    await expect(page.getByTestId('sim-bottom-bar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Paso' })).toHaveCount(0);
    // Reproducir, Pausa y Reiniciar sí están, en la barra fija.
    const bar = page.getByTestId('sim-bottom-bar');
    await expect(bar.getByRole('button', { name: 'Reproducir' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Pausa' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Reiniciar' })).toBeVisible();
  });
});
