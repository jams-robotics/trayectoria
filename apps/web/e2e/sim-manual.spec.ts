import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-04 (#130, decisión 6): el modo manual de `/simuladores/movil`. Sin Supabase: lo que se
// prueba es que, con el controlador manual, el teclado sobre el visor enfocado y los botones
// táctiles con `pointerdown` conducen el robot, y que el grupo «Referencia» del selector trae los
// tres robots del catálogo.
//
// Las comprobaciones avanzan la simulación con pulsaciones de «Paso», no con «Reproducir»: un
// número fijo de pasos es el mismo número de `model.step()` en cualquier máquina, mientras que
// el bucle de fotogramas reparte el tiempo real de forma distinta (mismo criterio que
// `sim-movil.spec.ts`, spec gap #155).

/** Pulsaciones de «Paso» de cada comprobación; a `dt_s = 0.005 s`, 0.5 s simulados. */
const STEPS = 100;

/** Lecturas de la pose que la página muestra. */
interface Pose {
  readonly x: string;
  readonly theta: string;
}

/** Abre la página y espera a que la isla esté asentada. */
async function open(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/simuladores/movil');
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.getByTestId('start-pose-s')).toBeVisible();
  await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
}

/** Cambia al controlador manual y deja el foco en el visor. */
async function manualMode(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Manual', exact: true }).click();
  await expect(page.getByTestId('manual-controls')).toBeVisible();
  await page.getByTestId('line-follower-viewport').focus();
}

/** La pose que la página muestra ahora mismo, en una sola evaluación del DOM. */
async function poseOf(page: Page): Promise<Pose> {
  return page.evaluate(() => {
    const read = (id: string): string =>
      document.querySelector(`[data-testid="line-follower-${id}"]`)?.textContent ?? '';
    return { x: read('x'), theta: read('theta') };
  });
}

/** Avanza la simulación `STEPS` pasos con el botón «Paso». */
async function advance(page: Page): Promise<void> {
  const step = page.getByRole('button', { name: 'Paso' }).first();
  for (let i = 0; i < STEPS; i += 1) await step.click();
}

test.describe('modo manual del simulador móvil (F4-04)', () => {
  test('con el teclado, el robot avanza y gira', async ({ page }) => {
    await open(page);
    await manualMode(page);
    const start = await poseOf(page);

    // ↑ tres veces: velocidad base 1.5 rad/s, sin diferencia, así que el robot avanza recto.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await advance(page);
    const forward = await poseOf(page);
    expect(forward.x).not.toBe(start.x);
    expect(forward.theta).toBe(start.theta);

    // → mantenida: la diferencia entre ruedas gira el robot mientras la tecla sigue pulsada.
    await page.keyboard.down('ArrowRight');
    await advance(page);
    await page.keyboard.up('ArrowRight');
    const turned = await poseOf(page);
    expect(turned.theta).not.toBe(forward.theta);
  });

  test('la ayuda de interacción acompaña al modo manual', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('manual-help')).toHaveCount(0);
    await manualMode(page);
    await expect(page.getByTestId('manual-help')).toBeVisible();
  });

  test('los botones táctiles conducen igual que el teclado', async ({ page }) => {
    await open(page);
    await manualMode(page);
    const start = await poseOf(page);

    await page.getByTestId('manual-up').dispatchEvent('pointerdown');
    await page.getByTestId('manual-up').dispatchEvent('pointerdown');
    await page.getByTestId('manual-up').dispatchEvent('pointerdown');
    await advance(page);
    const forward = await poseOf(page);
    expect(forward.x).not.toBe(start.x);

    await page.getByTestId('manual-right').dispatchEvent('pointerdown');
    await advance(page);
    const turned = await poseOf(page);
    expect(turned.theta).not.toBe(forward.theta);

    // Al soltar, la diferencia vuelve a 0 y el robot deja de girar. La rampa de aceleración del
    // robot tarda unos pasos en igualar las dos ruedas, así que el rumbo se compara una vez
    // asentado: dos tramos seguidos de `STEPS` pasos ya dejan el mismo θ.
    await page.getByTestId('manual-right').dispatchEvent('pointerup');
    await advance(page);
    const settled = await poseOf(page);
    await advance(page);
    expect((await poseOf(page)).theta).toBe(settled.theta);
  });

  test('el selector ofrece el grupo «Referencia» con los tres robots del catálogo', async ({
    page,
  }) => {
    await open(page);
    const select = page.getByTestId('robot-source-select');
    const group = select.locator('optgroup[label="Referencia"]');
    await expect(group).toHaveCount(1);
    await expect(group.locator('option')).toHaveCount(3);
    await expect(group.locator('option').first()).toContainText('m/s');

    // Elegir uno de referencia cambia el robot simulado: la página vuelve a `t = 0`.
    const value = await group.locator('option').first().getAttribute('value');
    await select.selectOption(value ?? '');
    await expect(page.getByTestId('line-follower-t')).toHaveText('0.00 s');
  });
});
