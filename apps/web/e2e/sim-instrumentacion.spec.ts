import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-03 (#129, decisión 7): la instrumentación de `/simuladores/movil`. Sin Supabase: la página
// abre con el óvalo y el PID por defecto, que es la corrida del criterio.
//
// La identidad `lapTime_s · avgSpeed_mps = trackLength_m` se comprueba sobre los atributos `data-`
// que la tarjeta publica sin redondear (enmienda de #129 tras #170), no sobre los dos decimales
// que se ven: el criterio pide 1e-9 y el texto formateado no llega.

/**
 * Margen real para que la vuelta se complete a velocidad 4×, en milisegundos. Con las cuatro
 * gráficas montadas cada fotograma hace bastante más trabajo que en `sim-movil.spec.ts`, así que
 * la vuelta tarda más en tiempo real aunque el tiempo simulado sea el mismo.
 */
const LAP_TIMEOUT_MS = 90_000;

/** Margen para la isla perezosa: el simulador entra con un `import()` aparte. */
const ISLAND_TIMEOUT_MS = 30_000;

/** Tolerancia de la identidad exacta, en metros (enmienda de #129 tras #170). */
const IDENTITY_TOLERANCE_M = 1e-9;

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Abre la página y espera a que la isla esté asentada, igual que `sim-movil.spec.ts`: el asa de
 * la pose inicial aparece cuando el simulador ya resolvió la pose de apertura, y aplicarla
 * reconstruye la simulación.
 */
async function open(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/simuladores/movil');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s', {
    timeout: ISLAND_TIMEOUT_MS,
  });
  // Con varios trabajadores a la vez el chunk del simulador tarda más de los 5 s por defecto en
  // resolverse en `astro dev`, así que el asa se espera con el mismo margen que la isla.
  await expect(page.getByTestId('start-pose-s')).toBeVisible({ timeout: ISLAND_TIMEOUT_MS });
}

/**
 * Pulsa un botón de la barra de controles bajo el visor.
 *
 * Se despacha el evento en lugar de hacer un `click()` de Playwright: con el panel «Gráficas» la
 * columna derecha crece mucho y, allá donde la página se desplace, esa columna acaba sobre el
 * punto de la barra, de modo que la comprobación de accionabilidad no deja pulsar aunque el botón
 * esté visible y habilitado. El botón es el de verdad y el evento el que React escucha.
 */
async function press(page: Page, name: string): Promise<void> {
  const button = page.getByRole('button', { name }).first();
  await expect(button).toBeEnabled();
  await button.dispatchEvent('click');
}

/** Reproduce a 4× hasta que el contador de vueltas del visor llega a 1, y pausa. */
async function runOneLap(page: Page): Promise<void> {
  await page.getByRole('combobox', { name: 'Velocidad de reproducción' }).selectOption('4');
  await press(page, 'Reproducir');
  await expect(page.getByTestId('line-follower-laps')).toHaveText('1', { timeout: LAP_TIMEOUT_MS });
  await press(page, 'Pausa');
}

/** Las cifras sin redondear que la tarjeta de vuelta publica. */
async function lapData(page: Page): Promise<{
  lapTime_s: number;
  avgSpeed_mps: number;
  distance_m: number;
  trackLength_m: number;
}> {
  const card = page.getByTestId('lap-card');
  const read = async (name: string): Promise<number> =>
    Number.parseFloat((await card.getAttribute(name)) ?? 'NaN');
  return {
    lapTime_s: await read('data-lap-time-s'),
    avgSpeed_mps: await read('data-avg-speed-mps'),
    distance_m: await read('data-distance-m'),
    trackLength_m: await read('data-track-length-m'),
  };
}

test.describe('instrumentación del simulador móvil (F4-03)', () => {
  // La vuelta completa con las cuatro gráficas montadas pasa del tiempo por defecto de un test.
  test.slow();

  test('al completar una vuelta la tarjeta muestra tiempo y velocidad, y lapTime · avgSpeed es la longitud del óvalo', async ({
    page,
  }) => {
    await open(page);

    // Antes de la primera vuelta la tarjeta está, pero con «—» en las cuatro cifras.
    await expect(page.getByTestId('lap-card')).toBeVisible();
    await expect(page.getByTestId('lap-card-last')).toHaveText('—');

    await runOneLap(page);

    // Ahora sí: el último tiempo, el mejor, la velocidad media y la distancia recorrida.
    await expect(page.getByTestId('lap-card-last')).toHaveText(/^\d+\.\d{2} s$/);
    await expect(page.getByTestId('lap-card-best')).toHaveText(/^\d+\.\d{2} s$/);
    await expect(page.getByTestId('lap-card-speed')).toHaveText(/^\d+\.\d{2} m\/s$/);
    await expect(page.getByTestId('lap-card-distance')).toHaveText(/^\d+\.\d{2} m$/);

    const lap = await lapData(page);
    expect(lap.lapTime_s).toBeGreaterThan(0);
    expect(lap.trackLength_m).toBeGreaterThan(0);
    // Identidad exacta con la longitud de la pista (enmienda de #129 tras #170). La longitud sale
    // de la propia página, así que el test no vuelve a calcular la geometría del preset.
    expect(Math.abs(lap.lapTime_s * lap.avgSpeed_mps - lap.trackLength_m)).toBeLessThanOrEqual(
      IDENTITY_TOLERANCE_M,
    );
    // Y la distancia recorrida queda por debajo de la longitud: el seguidor corta las curvas.
    expect(lap.distance_m).toBeGreaterThan(0);
    expect(lap.distance_m).toBeLessThan(lap.trackLength_m);
  });

  test('el panel «Gráficas» pinta las cuatro gráficas con el PID seleccionado', async ({ page }) => {
    await open(page);

    const panel = page.getByTestId('panel-plots');
    await expect(panel).toBeVisible();
    for (const id of ['plot-error', 'plot-v', 'plot-omega', 'plot-pid']) {
      await expect(panel.getByTestId(id)).toBeVisible();
    }

    // Con el controlador P no hay términos que separar, así que la gráfica del PID desaparece.
    await page.getByRole('button', { name: 'P', exact: true }).click();
    await expect(panel.getByTestId('plot-pid')).toHaveCount(0);
    await expect(panel.getByTestId('plot-error')).toBeVisible();
  });

  test('«Reiniciar» borra la tarjeta y el cronómetro vuelve a «—»', async ({ page }) => {
    await open(page);
    await runOneLap(page);
    await expect(page.getByTestId('lap-card-last')).not.toHaveText('—');

    await press(page, 'Reiniciar');

    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
    await expect(page.getByTestId('lap-card-last')).toHaveText('—');
    await expect(page.getByTestId('lap-card-best')).toHaveText('—');
  });

  test('a 390 px «Gráficas» es un acordeón más de la columna', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await open(page);

    // Robot, Pista, Controlador, Lecturas, Gráficas y «Guardar y compartir»: seis acordeones.
    await expect(page.getByTestId('sim-accordion')).toHaveCount(6);
    await expect(page.getByRole('button', { name: /^Gráficas/ })).toBeVisible();
  });
});
