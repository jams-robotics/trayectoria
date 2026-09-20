import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F5-03 (#136, decisión 6): el espacio de trabajo sobre `/simuladores/brazo`. Sin Supabase: la
// página es estática y el brazo sale del catálogo servido en `/catalog/**`. El cálculo se lanza
// con `n = 5 000` para que termine rápido sin dejar de recorrer varios lotes.

/** Margen para la isla perezosa: su chunk arrastra three y urdf-loader. */
const ISLAND_TIMEOUT_MS = 30_000;

/** Muestras del cálculo del e2e (decisión 6). */
const SAMPLE_COUNT = 5_000;

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 900 };

/** Abre la página del simulador con un brazo y espera a que el visor esté listo. */
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

/** Enciende el control «Espacio de trabajo» y espera al panel. */
async function enableWorkspace(page: Page): Promise<void> {
  await page.locator('[data-testid="workspace-toggle"]').click();
  await expect(page.locator('[data-testid="workspace-panel"]')).toBeVisible({
    timeout: ISLAND_TIMEOUT_MS,
  });
}

/** Pone `n` en el campo y pulsa Calcular. */
async function compute(page: Page, n: number): Promise<void> {
  await page.locator('[data-testid="workspace-count"]').fill(String(n));
  await page.locator('[data-testid="workspace-compute"]').click();
}

test.describe('/simuladores/brazo · espacio de trabajo (F5-03)', () => {
  test('el control arranca apagado y enciende el panel', async ({ page }) => {
    await openArm(page, 'planar2dof');
    const toggle = page.locator('[data-testid="workspace-toggle"]');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-testid="workspace-panel"]')).toHaveCount(0);

    await enableWorkspace(page);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // El campo arranca en el valor por defecto del ticket.
    await expect(page.locator('[data-testid="workspace-count"]')).toHaveValue('20000');
    await expect(page.locator('[data-testid="workspace-visibility"]')).toBeDisabled();
  });

  test('calcular con n = 5 000 muestra la barra y termina con la nube visible', async ({
    page,
  }) => {
    await openArm(page, 'planar2dof');
    await enableWorkspace(page);
    await compute(page, SAMPLE_COUNT);

    // Mientras corre, el botón ofrece cancelar y la barra anuncia el progreso.
    await expect(page.locator('[data-testid="workspace-compute"]')).toHaveText('Cancelar');
    await expect(page.locator('[data-testid="workspace-progress"]')).toBeVisible();

    // Al terminar, el botón vuelve a Calcular y el estado declara las muestras de la nube.
    await expect(page.locator('[data-testid="workspace-compute"]')).toHaveText('Calcular', {
      timeout: ISLAND_TIMEOUT_MS,
    });
    await expect(page.locator('[data-testid="workspace-status"]')).toContainText(
      String(SAMPLE_COUNT),
    );
    const visibility = page.locator('[data-testid="workspace-visibility"]');
    await expect(visibility).toBeEnabled();
    await expect(visibility).toHaveAttribute('aria-pressed', 'true');
  });

  test('el toggle oculta la nube y vuelve a mostrarla', async ({ page }) => {
    await openArm(page, 'planar2dof');
    await enableWorkspace(page);
    await compute(page, SAMPLE_COUNT);
    const visibility = page.locator('[data-testid="workspace-visibility"]');
    await expect(visibility).toBeEnabled({ timeout: ISLAND_TIMEOUT_MS });

    await visibility.click();
    await expect(visibility).toHaveAttribute('aria-pressed', 'false');
    await expect(visibility).toHaveText('Mostrar');

    await visibility.click();
    await expect(visibility).toHaveAttribute('aria-pressed', 'true');
    await expect(visibility).toHaveText('Ocultar');
  });

  test('cancelar a mitad deja el panel listo para volver a calcular', async ({ page }) => {
    await openArm(page, 'planar2dof');
    await enableWorkspace(page);
    // El máximo del campo: da margen de sobra para cancelar antes de que termine.
    await compute(page, 200_000);

    const button = page.locator('[data-testid="workspace-compute"]');
    await expect(button).toHaveText('Cancelar');
    await button.click();

    await expect(button).toHaveText('Calcular');
    await expect(page.locator('[data-testid="workspace-progress"]')).toHaveCount(0);
    // Sin nube: el toggle sigue deshabilitado porque el cálculo no llegó a entregar nada.
    await expect(page.locator('[data-testid="workspace-visibility"]')).toBeDisabled();
  });

  test('a 390 px el panel del espacio de trabajo es un acordeón más', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openArm(page, 'planar2dof');
    // En móvil los controles de vista están plegados: hay que abrirlos para llegar al botón.
    await page.locator('[data-testid="sim-accordion"] button[aria-expanded]').first().click();
    await page.locator('[data-testid="workspace-toggle"]').click();

    const headers = page.locator('[data-testid="sim-accordion"] button[aria-expanded]');
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(3)).toContainText('Espacio de trabajo');

    await headers.nth(3).click();
    await expect(page.locator('[data-testid="workspace-panel"]')).toBeVisible();
    // Sigue habiendo un solo acordeón abierto a la vez (docs/DESIGN.md §9.4).
    await expect(
      page.locator('[data-testid="sim-accordion"] button[aria-expanded="true"]'),
    ).toHaveCount(1);
  });
});
