import { expect, test, type Locator, type Page } from '@playwright/test';

import widgets from '../../../packages/i18n/locales/es/widgets.json' with { type: 'json' };

// F2-11 acceptance criteria, on the `/dev/widgets` playground and with no session: the store
// falls back to `localStorage` and the Supabase adapter is never attached, so Supabase is not
// needed (#95, decisions 2, 3 and 9). The remote half is covered by the unit test of the
// adapter with a mocked client.
const MY_ROBOT = widgets.MyRobotWidget;

/** The `Live` story: the form and a `DiffDriveWidget` reading the same store (decision 8). */
function live(page: Page): Locator {
  return page.locator('[data-widget="MyRobotWidget"] [data-story="Live"]');
}

function field(scope: Locator, key: string): Locator {
  return scope.locator(`[data-field="${key}"]`).getByRole('textbox');
}

/** `v` of the `DiffDriveWidget`: the value cell next to the «Velocidad lineal» term. */
function linearSpeed(scope: Locator): Locator {
  return scope
    .locator('[data-testid="readout-panel"] div')
    .filter({ has: scope.page().getByText(widgets.DiffDriveWidget.v, { exact: true }) })
    .locator('dd')
    .first();
}

async function openPlayground(page: Page): Promise<void> {
  await page.goto('/dev/widgets');
  // Astro removes the `ssr` attribute of an island once React has hydrated it; a click or a
  // fill landing before that is silently a no-op (e2e/auth.spec.ts, F2-01a ronda 1).
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** Types `value` into a field, retrying until it sticks, and presses «Guardar». */
async function saveWheelRadius(scope: Locator, value: string): Promise<void> {
  const input = field(scope, 'wheelRadius_m');
  await expect
    .poll(async () => {
      await input.fill(value);
      return input.inputValue();
    })
    .toBe(value);
  const save = scope.getByRole('button', { name: MY_ROBOT.save });
  await expect
    .poll(async () => {
      await save.click();
      return scope.locator('[data-testid="toast"]').count();
    })
    .toBeGreaterThan(0);
}

test('saving a new wheel radius moves v of the DiffDriveWidget with no reload', async ({
  page,
}) => {
  await openPlayground(page);
  const scope = live(page);

  // The reference robot: ω_L = ω_R = 10 rad/s on r = 0.032 m gives v = 0.32 m/s.
  await expect(linearSpeed(scope)).toHaveText('0.320 m/s');

  await saveWheelRadius(scope, '0.05');

  // Same wheel speeds on r = 0.05 m: v = 0.5 m/s, with no page reload.
  await expect(linearSpeed(scope)).toHaveText('0.500 m/s');
  await expect(scope.locator('[data-testid="toast"]')).toHaveText(MY_ROBOT.saved);
});

test('the saved robot survives a reload (localStorage)', async ({ page }) => {
  await openPlayground(page);
  await saveWheelRadius(live(page), '0.05');

  await page.reload();
  await openPlayground(page);
  const scope = live(page);

  await expect(field(scope, 'wheelRadius_m')).toHaveValue('0.05');
  await expect(linearSpeed(scope)).toHaveText('0.500 m/s');
});

test('a wheel radius out of range shows the error and does not save', async ({ page }) => {
  await openPlayground(page);
  const scope = live(page);

  // 0.5 m is outside the [0.005, 0.3] range of MobileSpec (#95, decision 7).
  await saveWheelRadius(scope, '0.5');

  await expect(
    scope.locator('[data-field="wheelRadius_m"] [data-testid="field-error"]'),
  ).toHaveText('Debe ser menor o igual que 0.3');
  await expect(scope.locator('[data-testid="toast"]')).toHaveAttribute('data-tone', 'error');
  // The simulator keeps the robot it had: nothing was written.
  await expect(linearSpeed(scope)).toHaveText('0.320 m/s');

  await page.reload();
  await openPlayground(page);
  await expect(field(live(page), 'wheelRadius_m')).toHaveValue('0.032');
});

test('«Restablecer al robot de referencia» brings the reference values back', async ({ page }) => {
  await openPlayground(page);
  const scope = live(page);

  await saveWheelRadius(scope, '0.05');
  await expect(field(scope, 'wheelRadius_m')).toHaveValue('0.05');

  const reset = scope.getByRole('button', { name: MY_ROBOT.reset });
  await expect
    .poll(async () => {
      await reset.click();
      return field(scope, 'wheelRadius_m').inputValue();
    })
    .toBe('0.032');

  await expect(linearSpeed(scope)).toHaveText('0.320 m/s');
});

test('the Card story follows the robot the form saves', async ({ page }) => {
  await openPlayground(page);
  const card = page.locator('[data-widget="MyRobotWidget"] [data-story="Card"]');

  await expect(card.locator('[data-card-item="wheelRadius_m"] dd')).toHaveText('0.032 m');

  await saveWheelRadius(live(page), '0.05');

  await expect(card.locator('[data-card-item="wheelRadius_m"] dd')).toHaveText('0.05 m');
});

test('the toast closes on its own after five seconds', async ({ page }) => {
  await openPlayground(page);
  const scope = live(page);

  await saveWheelRadius(scope, '0.05');
  const toast = scope.locator('[data-testid="toast"]');
  await expect(toast).toBeVisible();

  await expect(toast).toBeHidden({ timeout: 8000 });
});
