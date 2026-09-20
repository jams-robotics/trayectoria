import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-05 (#131, decisión 8): «Guardar y compartir» de `/simuladores/movil`. Lo que se prueba es la
// vuelta completa: cambiar `Kp`, copiar el enlace, abrirlo en otra página y comprobar que los
// parámetros coinciden y que la pose tras el mismo número de pasos es idéntica; y que guardar sin
// sesión y recargar conserva la lista.
//
// Sin Supabase: la escritura en `robots.spec.simConfigs` la cubre el test del adaptador con
// cliente mockeado. Aquí la lista es la local, que es la que ve un estudiante sin sesión.
//
// El determinismo se mide con pulsaciones de «Paso» y no con «Reproducir» (spec gap #155,
// resuelto): «Reproducir» integra el tiempo real de cada fotograma, así que el estado depende del
// reparto de fotogramas de la máquina; un número fijo de pasos es el mismo número de `model.step()`
// en cualquier parte, y la pose que sale es exacta.

/** Pasos simulados de la comprobación de determinismo: 10 s a `dt_s = 0.01` (criterio del ticket). */
const STEPS_10_S = 1000;

/** Lo que muestran las lecturas del visor. */
interface Readout {
  readonly t: string;
  readonly x: string;
  readonly y: string;
  readonly theta: string;
}

/** Abre la página y espera a que la isla esté asentada (mismo patrón que `sim-movil.spec.ts`). */
async function open(page: Page, search = ''): Promise<void> {
  await page.goto(`/simuladores/movil${search}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('start-pose-s')).toBeVisible();
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
}

/** Lee las lecturas del visor tal y como se ven. */
async function readout(page: Page): Promise<Readout> {
  return page.evaluate(() => {
    const read = (id: string): string =>
      document.querySelector(`[data-testid="line-follower-${id}"]`)?.textContent ?? '';
    return { t: read('t'), x: read('x'), y: read('y'), theta: read('theta') };
  });
}

/**
 * Pulsa «Paso» `steps` veces y devuelve el estado resultante. Las pulsaciones se despachan dentro
 * de la página: son cientos, y el ida y vuelta del protocolo por cada una agotaría el tiempo del
 * test. El botón es el de verdad y el evento el que React escucha.
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
  await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeDisabled();
  return readout(page);
}

/** Baja `Kp` con el teclado hasta salir de su valor de apertura, y devuelve el que queda. */
async function changeKp(page: Page): Promise<string> {
  const kp = page.getByRole('slider', { name: /^Kp/ });
  const before = await kp.inputValue();
  await kp.press('ArrowLeft');
  await kp.press('ArrowLeft');
  await expect(kp).not.toHaveValue(before);
  return kp.inputValue();
}

/** El enlace que muestra el campo de «Guardar y compartir», ya codificado. */
async function shareLink(page: Page): Promise<string> {
  const field = page.getByTestId('sim-config-link');
  await expect(field).not.toHaveValue('');
  return field.inputValue();
}

test.describe('guardar y compartir la configuración (F4-05)', () => {
  test('el enlace copiado reproduce parámetros y pose a los 10 s simulados', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);

    // Un `Kp` distinto del de apertura: si el enlace no lo llevara, la otra página abriría con el
    // de siempre y las poses no coincidirían.
    const kp = await changeKp(page);
    const link = await shareLink(page);
    expect(link).toMatch(/\/simuladores\/movil\?c=[A-Za-z0-9_-]+$/);

    // «Copiar enlace» deja en el portapapeles exactamente lo que el campo muestra, y avisa.
    await page.getByTestId('sim-config-copy').click();
    await expect(page.getByTestId('toast')).toHaveText('Copiado');
    const copied = await page.evaluate(async () => navigator.clipboard.readText());
    expect(copied).toBe(link);

    const first = await stepAndRead(page, STEPS_10_S);

    // La otra página abre el enlace copiado: mismos parámetros y misma pose tras los mismos pasos.
    const other = await context.newPage();
    await open(other, new URL(copied).search);
    await expect(other.getByRole('slider', { name: /^Kp/ })).toHaveValue(kp);
    const second = await stepAndRead(other, STEPS_10_S);

    // Igualdad exacta, sin tolerancia: misma semilla, mismos parámetros, mismo número de pasos.
    expect(second).toEqual(first);
    // Y los pasos han avanzado de verdad: un estado congelado en el arranque también sería igual.
    expect(Number.parseFloat(first.t)).toBeGreaterThan(0);
    await other.close();
  });

  test('un enlace inválido avisa y abre con los valores por defecto', async ({ page }) => {
    await open(page, '?c=***');

    await expect(page.getByTestId('toast')).toContainText('El enlace no es una configuración');
    await expect(page.getByTestId('toast')).toHaveAttribute('data-tone', 'error');
    // Los valores de apertura de la página: el óvalo y el PID (F4-02b).
    await expect(page.getByTestId('track-source-select')).toHaveValue('oval');
    await expect(page.getByRole('button', { name: 'PID', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('guardar sin sesión y recargar conserva la configuración, y cargarla la aplica', async ({
    page,
  }) => {
    await open(page);
    const kp = await changeKp(page);

    await page.getByTestId('sim-config-name').fill('Óvalo lento');
    await page.getByTestId('sim-config-save').click();
    await expect(page.getByTestId('sim-config-list')).toContainText('Óvalo lento');

    // Recargar la página: la lista sigue ahí, guardada en el navegador.
    await open(page);
    await expect(page.getByTestId('sim-config-list')).toContainText('Óvalo lento');
    // Y la página ha vuelto a abrir con el `Kp` de siempre, no con el guardado.
    await expect(page.getByRole('slider', { name: /^Kp/ })).not.toHaveValue(kp);

    // «Cargar» aplica el `Kp` guardado y deja la simulación pausada en t = 0.
    await page.getByTestId('sim-config-load').first().click();
    await expect(page.getByRole('slider', { name: /^Kp/ })).toHaveValue(kp);
    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
    await expect(page.getByRole('button', { name: 'Pausa' }).first()).toBeDisabled();
  });

  test('«Borrar» pide confirmación y quita la configuración de la lista', async ({ page }) => {
    await open(page);
    await page.getByTestId('sim-config-name').fill('Para borrar');
    await page.getByTestId('sim-config-save').click();
    await expect(page.getByTestId('sim-config-list')).toContainText('Para borrar');

    await page.getByTestId('sim-config-delete').first().click();
    await expect(page.getByTestId('sim-config-delete-confirm')).toBeVisible();
    await page.getByTestId('sim-config-delete-confirm').click();

    await expect(page.getByText('Para borrar')).toHaveCount(0);
  });
});
