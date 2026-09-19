import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-02b (#128, decisión 6): la página `/simuladores/movil`. Sin Supabase: el selector de robots
// guardados no entra aquí (lo cubre el test unitario de la consulta con cliente mockeado); lo que
// se prueba es la vuelta completa con el preset óvalo y el PID por defecto, el determinismo de
// dos cargas y la maqueta de 390 px.

/** Tiempo simulado máximo admitido para la primera vuelta, en segundos (el modelo tarda ≈ 8,6 s). */
const LAP_LIMIT_S = 60;

/** Margen real para que la vuelta se complete a velocidad 4×, en milisegundos. */
const LAP_TIMEOUT_MS = 30_000;

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Abre la página y espera a que la isla esté asentada: el asa de la pose inicial solo aparece
 * cuando el módulo del simulador ya resolvió la pose de apertura, y aplicarla reconstruye la
 * simulación. Reproducir antes de eso arrancaría una carrera que el propio reinicio detiene.
 */
async function open(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/simuladores/movil');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('start-pose-s')).toBeVisible();
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
}

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

  // El criterio «dos ejecuciones muestran el mismo `t` al completar la vuelta» está bloqueado por
  // el spec gap #155: el modelo es determinista, pero el `t` que la interfaz muestra al cruzar la
  // salida depende del reparto de pasos entre fotogramas de tiempo real (dispersión medida de
  // ~0.14 s). El test se añadirá cuando el spec gap fije el observable y la tolerancia.

  test('a 390 px los paneles son acordeones, hay barra inferior y no hay «Paso»', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await open(page);

    // Robot, Pista, Controlador y Lecturas pasan a acordeones (docs/DESIGN.md §9.8).
    await expect(page.getByTestId('sim-accordion')).toHaveCount(4);
    await expect(page.getByTestId('sim-bottom-bar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Paso' })).toHaveCount(0);
    // Reproducir, Pausa y Reiniciar sí están, en la barra fija.
    const bar = page.getByTestId('sim-bottom-bar');
    await expect(bar.getByRole('button', { name: 'Reproducir' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Pausa' })).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Reiniciar' })).toBeVisible();
  });
});
