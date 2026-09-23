import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import widgets from '../../../packages/i18n/locales/es/widgets.json' with { type: 'json' };
import { E2E_PASSWORD, signUp } from './helpers/supabase';
import { openMobileSim, readout } from './sim-movil.helpers';

// Decisión del orquestador (2026-09-23, PR #250, segunda ronda de seguridad, #238): antes de
// este fix, `startRobotPersistence()` solo se llamaba desde `MyRobotIsland`, que únicamente
// monta en `/cuenta`. Fuera de ahí `currentOwnerId` se quedaba en `null`
// (`packages/widgets/src/stores/myRobot.ts`) y un alumno con sesión veía el robot de
// referencia en los simuladores en vez del suyo. `RobotSession` (montada ahora en
// `apps/web/src/layouts/Base.astro`) corre en toda página; este test lo comprueba con sesión
// de verdad, guardando el robot en `/cuenta` y viéndolo en `/simuladores/movil`.

const MY_ROBOT = widgets.MyRobotWidget;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

// Astro quita el atributo `ssr` de una isla cuando React ya la hidrató; escribir antes de eso
// se pierde (los inputs controlados empiezan vacíos).
async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** Guarda un radio de rueda distinto del de referencia (0.032 m) desde el formulario de `/cuenta`. */
async function saveCustomWheelRadius(page: Page): Promise<void> {
  await openHydrated(page, '/cuenta');
  const form = page.getByTestId('my-robot-form');
  const input = form.locator('[data-field="wheelRadius_m"]').getByRole('textbox');
  await expect
    .poll(async () => {
      await input.fill('0.05');
      return input.inputValue();
    })
    .toBe('0.05');
  const save = form.getByRole('button', { name: MY_ROBOT.save });
  await expect
    .poll(async () => {
      await save.click();
      return form.locator('[data-testid="toast"]').count();
    })
    .toBeGreaterThan(0);
}

/** Cierra sesión desde `/cuenta`, donde vive el botón. */
async function signOut(page: Page): Promise<void> {
  await openHydrated(page, '/cuenta');
  await page.getByRole('button', { name: auth.account.signOut }).click();
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
}

/**
 * Reproduce a 4× hasta que el reloj simulado pasa de `minSimSeconds`, pausa y devuelve la `x`
 * resultante. `dt_s` por defecto es 1 ms (`DEFAULT_DT_S`, `@trayectoria/sim-core`), así que unos
 * pocos «Paso» no bastan para mover al robot lo suficiente como para que se note en la lectura
 * de 3 decimales; esperar un tramo del reloj simulado (una vuelta del óvalo tarda ≈ 8.6 s) sí
 * lo hace, y un radio de rueda distinto cambia la velocidad lineal (`v = ω·r`), así que la
 * misma ventana de tiempo deja al robot en una `x` distinta.
 */
async function playUntilReadX(page: Page, minSimSeconds: number): Promise<string> {
  await page.getByRole('combobox', { name: 'Velocidad de reproducción' }).selectOption('4');
  await page.getByRole('button', { name: 'Reproducir' }).first().click();
  await expect
    .poll(async () => Number.parseFloat((await readout(page)).t), { timeout: 20_000 })
    .toBeGreaterThanOrEqual(minSimSeconds);
  await page.getByRole('button', { name: 'Pausa' }).first().click();
  return (await readout(page)).x;
}

test('el robot guardado en /cuenta se ve en /simuladores/movil, no solo en /cuenta; al cerrar sesión vuelve al de referencia', async ({
  page,
}) => {
  const email = uniqueEmail('mi-robot-fuera-de-cuenta');
  await signUp('student', 'Alumna E2E', email);
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');

  await saveCustomWheelRadius(page);

  // El selector de robot de `/simuladores/movil` abre en «Mi robot» por defecto
  // (`useMobileSimState.ts`); ese robot ahora tiene un radio de rueda distinto del de
  // referencia, así que la pose tras el mismo número de pasos también difiere.
  await openMobileSim(page);
  await expect(page.getByTestId('robot-source-select')).toHaveValue('my-robot');
  const xWithOwnRobot = await playUntilReadX(page, 2);

  await signOut(page);

  await openMobileSim(page);
  await expect(page.getByTestId('robot-source-select')).toHaveValue('my-robot');
  const xWithReferenceRobot = await playUntilReadX(page, 2);

  expect(xWithOwnRobot).not.toEqual(xWithReferenceRobot);
});
