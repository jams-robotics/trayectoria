import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-02a (#127): el bucle de reproducción del `LineFollowerWidget` sobre la story `Oval` de
// /dev/sims. Los tests de Vitest del paquete llaman a `model.step()` y a las acciones del driver
// directamente; este cubre lo que ninguno de ellos ejercita, el bucle real de
// `requestAnimationFrame` dentro del navegador, que es donde QA vio que «Reproducir» no avanzaba.

/** Sección del playground y story que se prueban. */
const SECTION = 'LineFollowerWidget';
const STORY = 'Oval';

/** Margen que se le da al bucle para mover el reloj tras pulsar Reproducir, en milisegundos. */
const PLAY_TIMEOUT_MS = 2000;

/**
 * Abre la galería filtrada a la sección del seguidor de línea y devuelve la story. La isla es
 * `client:only`, así que el DOM llega vacío: esperar a que un `[data-story]` sea visible es la
 * puerta de hidratación de esta página (mismo criterio que `track-editor.spec.ts`).
 */
async function openStory(page: Page): Promise<Locator> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/dev/sims?section=${SECTION}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.locator('[data-story]').first()).toBeVisible();
  const story = page.locator(`[data-section="${SECTION}"] [data-story="${STORY}"]`);
  await expect(story).toBeVisible();
  // El reloj a `00.00` es la puerta de «el modelo ya publicó su estado inicial».
  await expect(story.locator('[data-testid="line-follower-t"]')).toHaveText('0.00 s');
  return story;
}

test.describe('LineFollowerWidget · bucle de reproducción (F4-02a)', () => {
  test('Reproducir avanza el reloj y mueve al robot', async ({ page }) => {
    const story = await openStory(page);
    const clock = story.locator('[data-testid="sim-clock"]');
    const x = story.locator('[data-testid="line-follower-x"]');
    const startX = await x.textContent();

    await story.getByRole('button', { name: 'Reproducir' }).click();

    // El reloj de `SimControls` muestra `t 00.00 s` con dos decimales: que deje de estar en cero
    // es la señal de que la simulación integra tiempo real, no solo de que el botón cambió.
    await expect(clock).not.toHaveText('t 00.00 s', { timeout: PLAY_TIMEOUT_MS });
    await expect(story.locator('[data-testid="line-follower-t"]')).not.toHaveText('0.00 s');
    await expect(x).not.toHaveText(startX ?? '', { timeout: PLAY_TIMEOUT_MS });
  });

  test('Paso en pausa avanza la simulación sin ponerla en marcha', async ({ page }) => {
    const story = await openStory(page);
    const clock = story.locator('[data-testid="sim-clock"]');
    const step = story.getByRole('button', { name: 'Paso' });

    // Un paso es `DEFAULT_DT_S` = 1 ms, que no se ve en un reloj de dos decimales; 20 pulsaciones
    // son 20 ms y el reloj pasa exactamente a `t 00.02 s`. La pose apenas se mueve en ese rato
    // (el robot arranca parado y acelera), así que el reloj es aquí el observable fiable.
    for (let k = 0; k < 20; k += 1) await step.click();

    await expect(clock).toHaveText('t 00.02 s');
    // Pulsar Paso no arranca el bucle: «Pausa» sigue deshabilitado porque nada está en marcha.
    await expect(story.getByRole('button', { name: 'Pausa' })).toBeDisabled();
  });
});
