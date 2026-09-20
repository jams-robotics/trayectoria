import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F5-02 (#135, decisión 6): el panel de matrices sobre `/simuladores/brazo`. Sin Supabase: la
// página es estática y el brazo sale del catálogo servido en `/catalog/**`. Los valores dorados
// son los del ticket, leídos en pantalla.

/** Margen para la isla perezosa: su chunk arrastra three y urdf-loader. */
const ISLAND_TIMEOUT_MS = 30_000;

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

/** Enciende el control «Matrices» y espera al panel. */
async function enableMatrices(page: Page): Promise<void> {
  await page.locator('[data-testid="matrices-toggle"]').click();
  await expect(page.locator('[data-testid="matrix-panel"]')).toBeVisible({
    timeout: ISLAND_TIMEOUT_MS,
  });
}

/** Pone un slider de las articulaciones en un valor en grados. */
async function setSlider(page: Page, index: number, value_deg: number): Promise<void> {
  await page
    .locator('[data-testid="joint-sliders"] input[type="range"]')
    .nth(index)
    .fill(String(value_deg));
}

/** La columna de traslación de la matriz visible: las tres primeras filas de la última columna. */
async function translationColumn(page: Page): Promise<string[]> {
  const cells = page.locator('[data-testid="matrix-block"] td');
  return [
    (await cells.nth(3).innerText()).trim(),
    (await cells.nth(7).innerText()).trim(),
    (await cells.nth(11).innerText()).trim(),
  ];
}

test.describe('/simuladores/brazo · matrices (F5-02)', () => {
  test('el control arranca apagado y enciende el panel', async ({ page }) => {
    await openArm(page, 'planar2dof');
    const toggle = page.locator('[data-testid="matrices-toggle"]');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-testid="matrix-panel"]')).toHaveCount(0);

    await enableMatrices(page);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // La cadena `⁰T_n = ⁰T_1 · … · ⁿ⁻¹T_n` se pinta con `Formula` (#135, decisión 1).
    await expect(page.locator('[data-testid="matrix-chain"]')).toBeVisible();
  });

  test('con el slider 1 a 90° y q₂ = 0 la acumulada muestra 0.000, 0.350, 0.000', async ({
    page,
  }) => {
    await openArm(page, 'planar2dof');
    await enableMatrices(page);

    await setSlider(page, 0, 90);
    await setSlider(page, 1, 0);

    // Criterio del ticket: la columna de traslación de `⁰T` del último eslabón de la cadena,
    // que es el mismo valor dorado que lee el panel del efector.
    await expect
      .poll(async () => (await translationColumn(page)).join(' '))
      .toBe('0.000 0.350 0.000');
    await expect(page.locator('[data-testid="sims.arm.y"]')).toHaveText('0.350');
  });

  test('los chips cambian la matriz visible y son operables con el teclado', async ({ page }) => {
    await openArm(page, 'planar2dof');
    await enableMatrices(page);
    await setSlider(page, 0, 90);
    await setSlider(page, 1, 0);

    const matrixChips = page.locator('[role="radiogroup"]').nth(1).locator('[role="radio"]');
    // El chip de `T_origen` del eslabón final: el desplazamiento fijo del URDF, 0.150 m en x.
    await matrixChips.nth(0).click();
    await expect.poll(async () => (await translationColumn(page))[0]).toBe('0.150');

    // Teclado: el chip recibe el foco con Tab y se activa con Enter.
    await matrixChips.nth(0).focus();
    await page.keyboard.press('Tab');
    await expect(matrixChips.nth(1)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(matrixChips.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

  test('elegir otro eslabón cambia la matriz mostrada', async ({ page }) => {
    await openArm(page, 'planar2dof');
    await enableMatrices(page);
    await setSlider(page, 0, 90);
    await setSlider(page, 1, 0);

    const linkChips = page.locator('[role="radiogroup"]').first().locator('[role="radio"]');
    await expect(linkChips).toHaveCount(4);
    // `⁰T₁` del primer eslabón: su marco está en el origen, no traslada.
    await linkChips.nth(1).click();
    await expect.poll(async () => (await translationColumn(page)).join(' ')).toBe(
      '0.000 0.000 0.000',
    );
  });

  test('a 390 px el panel de matrices es un acordeón más', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openArm(page, 'planar2dof');
    // En móvil los controles de vista están plegados: hay que abrirlos para llegar al botón.
    await page.locator('[data-testid="sim-accordion"] button[aria-expanded]').first().click();
    await page.locator('[data-testid="matrices-toggle"]').click();

    // El panel llega como un acordeón más; su contenido queda plegado hasta que se abre, igual
    // que «Articulaciones» y «Efector» (docs/DESIGN.md §9.4).
    const headers = page.locator('[data-testid="sim-accordion"] button[aria-expanded]');
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(3)).toContainText('Matrices');
    await expect(page.locator('[data-testid="matrix-panel"]')).toHaveCount(1);

    await headers.nth(3).click();
    await expect(page.locator('[data-testid="matrix-panel"]')).toBeVisible();
    // Sigue habiendo un solo acordeón abierto a la vez.
    await expect(
      page.locator('[data-testid="sim-accordion"] button[aria-expanded="true"]'),
    ).toHaveCount(1);
  });
});
