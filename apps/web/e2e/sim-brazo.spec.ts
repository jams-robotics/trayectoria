import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F5-01b (#134, decisión 5): la página `/simuladores/brazo` sobre la isla `client:only` de
// `ArmSimIsland`. Sin Supabase: la página es estática y el brazo sale del catálogo servido en
// `/catalog/**`. Los valores dorados son los de F5-01a leídos en pantalla.

/** Margen para la isla perezosa: su chunk arrastra three y urdf-loader. */
const ISLAND_TIMEOUT_MS = 30_000;

/** URDF del brazo de referencia; de ahí sale cuántas articulaciones actuadas se esperan. */
const SO101_URDF = path.resolve(import.meta.dirname, '../../../catalog/arms/so101/so101.urdf');

/**
 * Cuántas articulaciones actuadas declara un URDF. `apps/web` no importa sim-core
 * (docs/ARCHITECTURE.md §3.1), así que el número se cuenta aquí con una expresión regular sobre
 * el archivo del catálogo, que es la misma fuente que lee `loadUrdf` (#134, decisión 5).
 */
function actuatedJointCount(urdfPath: string): number {
  const urdf = readFileSync(urdfPath, 'utf8');
  return urdf.match(/<joint\b[^>]*\btype="(?:revolute|continuous|prismatic)"/g)?.length ?? 0;
}

/**
 * Abre la página del simulador con un brazo y espera a que el visor esté listo. La isla es
 * `client:only`, así que el DOM llega vacío: que el panel del efector tenga un número es la
 * puerta de «el URDF ya cargó y sim-core resolvió la pose» (mismo criterio que
 * `e2e/visual/sims.spec.ts` para la sección `ArmViewer`).
 */
async function openArm(page: Page, robot: string): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/simuladores/brazo?robot=${robot}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.locator('[data-testid="arm-viewer"]')).toBeVisible({
    timeout: ISLAND_TIMEOUT_MS,
  });
  await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
    timeout: ISLAND_TIMEOUT_MS,
  });
}

/** Pone un slider de `ParamPanel` en un valor y dispara los eventos que React escucha. */
async function setSlider(page: Page, index: number, value_deg: number): Promise<void> {
  const slider = page.locator('[data-testid="joint-sliders"] input[type="range"]').nth(index);
  await slider.fill(String(value_deg));
}

test.describe('/simuladores/brazo (F5-01b)', () => {
  test('planar2dof con q₁ = 90° y q₂ = 0° coloca el efector en y = 0.350 m', async ({ page }) => {
    await openArm(page, 'planar2dof');

    // Valor dorado de F5-01a: con l₁ = 0,20 m y l₂ = 0,15 m, girar solo la primera articulación
    // 90° deja el efector sobre +y a la suma de los dos eslabones.
    await setSlider(page, 0, 90);
    await setSlider(page, 1, 0);

    await expect(page.locator('[data-testid="sims.arm.x"]')).toHaveText('0.000');
    await expect(page.locator('[data-testid="sims.arm.y"]')).toHaveText('0.350');
    await expect(page.locator('[data-testid="sims.arm.z"]')).toHaveText('0.000');
  });

  test('so101 carga sin errores de consola y con un slider por articulación actuada', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await openArm(page, 'so101');

    const sliders = page.locator('[data-testid="joint-sliders"] input[type="range"]');
    await expect(sliders).toHaveCount(actuatedJointCount(SO101_URDF));
    expect(errors).toEqual([]);
  });

  test('un id desconocido cae en planar2dof y lo avisa', async ({ page }) => {
    await openArm(page, 'no-existe');

    await expect(page.locator('[data-testid="arm-source-fallback"]')).toBeVisible();
    // El selector queda en el brazo por defecto, no en el id inventado.
    await expect(page.locator('[data-testid="arm-source-select"]')).toHaveValue('planar2dof');
  });

  test('cambiar de brazo en el selector actualiza la URL', async ({ page }) => {
    await openArm(page, 'planar2dof');

    await page.locator('[data-testid="arm-source-select"]').selectOption('so101');

    await expect(page).toHaveURL(/\?robot=so101$/);
    await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
      timeout: ISLAND_TIMEOUT_MS,
    });
  });
});
