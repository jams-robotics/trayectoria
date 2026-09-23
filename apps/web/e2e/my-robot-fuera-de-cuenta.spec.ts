import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import widgets from '../../../packages/i18n/locales/es/widgets.json' with { type: 'json' };
import { E2E_PASSWORD, signUp } from './helpers/supabase';
import { openMobileSim, readout } from './sim-movil.helpers';

// Orchestrator decision (2026-09-23, PR #250, second security round, #238): before this fix,
// `startRobotPersistence()` was only called from `MyRobotIsland`, which only mounts on
// `/cuenta`. Outside of that, `currentOwnerId` (`packages/widgets/src/stores/myRobot.ts`)
// stayed `null` and a signed-in student would see the reference robot in the simulators
// instead of their own. `RobotSession` (now mounted in `apps/web/src/layouts/Base.astro`)
// runs on every page; this test verifies that with a real session, saving the robot in
// `/cuenta` and seeing it in `/simuladores/movil`.

const MY_ROBOT = widgets.MyRobotWidget;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

// Astro removes the `ssr` attribute from an island once React has hydrated it; typing before
// that is lost (controlled inputs start out empty).
async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** Saves a wheel radius different from the reference one (0.032 m) from the `/cuenta` form. */
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

/** Signs out from `/cuenta`, where the button lives. */
async function signOut(page: Page): Promise<void> {
  await openHydrated(page, '/cuenta');
  await page.getByRole('button', { name: auth.account.signOut }).click();
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
}

/**
 * Plays back at 4x until the simulated clock passes `minSimSeconds`, pauses, and returns the
 * resulting `x`. `dt_s` defaults to 1 ms (`DEFAULT_DT_S`, `@trayectoria/sim-core`), so a few
 * "Paso" clicks aren't enough to move the robot far enough to notice at 3 decimal places;
 * waiting for a stretch of simulated clock (one lap of the oval takes ≈ 8.6 s) does, and a
 * different wheel radius changes the linear speed (`v = ω·r`), so the same time window leaves
 * the robot at a different `x`.
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

  // The robot selector in `/simuladores/movil` opens on "Mi robot" by default
  // (`useMobileSimState.ts`); that robot now has a wheel radius different from the reference
  // one, so the pose after the same number of steps also differs.
  await openMobileSim(page);
  await expect(page.getByTestId('robot-source-select')).toHaveValue('my-robot');
  const xWithOwnRobot = await playUntilReadX(page, 2);

  await signOut(page);

  await openMobileSim(page);
  await expect(page.getByTestId('robot-source-select')).toHaveValue('my-robot');
  const xWithReferenceRobot = await playUntilReadX(page, 2);

  expect(xWithOwnRobot).not.toEqual(xWithReferenceRobot);
});
