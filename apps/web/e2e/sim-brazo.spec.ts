import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F5-01b (#134, decisión 5): la página `/simuladores/brazo` sobre la isla `client:only` de
// `ArmSimIsland`. Sin Supabase: la página es estática y el brazo sale del catálogo servido en
// `/catalog/**`. Los valores dorados son los de F5-01a leídos en pantalla.

/** Margen para la isla perezosa: su chunk arrastra three y urdf-loader. */
const ISLAND_TIMEOUT_MS = 30_000;

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 900 };

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
  // El panel del efector está plegado en móvil, así que la puerta de «sim-core ya resolvió la
  // pose» se lee sobre el nodo aunque esté oculto: `toHaveText` no exige visibilidad.
  await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
    timeout: ISLAND_TIMEOUT_MS,
  });
}

/** Pone un slider de `ParamPanel` en un valor y dispara los eventos que React escucha. */
async function setSlider(page: Page, index: number, value_deg: number): Promise<void> {
  const slider = page.locator('[data-testid="joint-sliders"] input[type="range"]').nth(index);
  await slider.fill(String(value_deg));
}

/**
 * Fracción del ancho y del alto del lienzo que ocupa lo que se dibuja del brazo (#556): píxeles
 * opacos con color saturado (eslabones, marcos) u oscuros (base); la rejilla y los ejes son grises
 * claros y el fondo del lienzo es transparente (lo pinta el CSS).
 */
async function armFill(page: Page): Promise<{ width: number; height: number }> {
  return page.locator('canvas').first().evaluate((element: HTMLCanvasElement) => {
    const copy = document.createElement('canvas');
    copy.width = element.width;
    copy.height = element.height;
    const ctx = copy.getContext('2d');
    if (ctx === null) return { width: 0, height: 0 };
    ctx.drawImage(element, 0, 0);
    const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
    let [x0, x1, y0, y1] = [copy.width, -1, copy.height, -1];
    for (let y = 0; y < copy.height; y += 1) {
      for (let x = 0; x < copy.width; x += 1) {
        const i = (y * copy.width + x) * 4;
        const [r = 0, g = 0, b = 0, a = 0] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        const saturated = Math.max(r, g, b) - Math.min(r, g, b) > 70;
        if (a < 200 || !(saturated || (r + g + b) / 3 < 110)) continue;
        [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
      }
    }
    if (x1 < 0) return { width: 0, height: 0 };
    return { width: (x1 - x0 + 1) / copy.width, height: (y1 - y0 + 1) / copy.height };
  });
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

  test('a 390 px los tres bloques son acordeones con uno solo abierto', async ({ page }) => {
    // docs/DESIGN.md §9.4 y #134 decisión 3: controles de vista, articulaciones y efector
    // plegados, con un único acordeón abierto a la vez.
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openArm(page, 'planar2dof');

    const headers = page.locator('[data-testid="sim-accordion"] button[aria-expanded]');
    await expect(headers).toHaveCount(3);
    await expect(headers.nth(0)).toContainText('Controles de vista');
    await expect(headers.nth(1)).toContainText('Articulaciones');
    await expect(headers.nth(2)).toContainText('Efector');

    // «Articulaciones» arranca abierto y es el único.
    await expect(page.locator('[data-testid="sim-accordion"] button[aria-expanded="true"]')).toHaveCount(1);
    await expect(headers.nth(1)).toHaveAttribute('aria-expanded', 'true');

    // Abrir «Efector» cierra «Articulaciones»: sigue habiendo uno solo abierto.
    await headers.nth(2).click();
    await expect(headers.nth(2)).toHaveAttribute('aria-expanded', 'true');
    await expect(headers.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-testid="sim-accordion"] button[aria-expanded="true"]')).toHaveCount(1);
  });

  test('los tres controles de vista son un solo grupo en una fila, «Marcos» incluido (#537)', async ({
    page,
  }) => {
    await openArm(page, 'planar2dof');

    const toggles = page.locator('[data-testid="view-controls"] button');
    await expect(toggles).toHaveCount(3);
    await expect(page.locator('[data-testid="frames-toggle"]')).toHaveCount(1);
    const tops = await toggles.evaluateAll((buttons) =>
      buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);
    // «Marcos» arranca encendido y se ve como los otros dos al activarse: relleno primario.
    const frames = page.locator('[data-testid="frames-toggle"]');
    const matrices = page.locator('[data-testid="matrices-toggle"]');
    await expect(frames).toHaveAttribute('aria-pressed', 'true');
    await matrices.click();
    await expect(matrices).toHaveAttribute('aria-pressed', 'true');
    const fill = (locator: typeof frames): Promise<string> =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);
    // El color cambia con una transición de 120 ms (docs/DESIGN.md §5): se espera a que acabe.
    const framesFill = await fill(frames);
    await expect.poll(() => fill(matrices)).toBe(framesFill);
  });

  test('a 390 px la cabecera de vista muestra el estado y «Marcos» va dentro (#542)', async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openArm(page, 'planar2dof');

    const view = page.locator('[data-testid="sim-accordion"]').nth(0);
    const header = view.locator('button[aria-expanded]');
    const text = (await header.textContent()) ?? '';
    expect(text.split('Controles de vista')).toHaveLength(2);
    expect(text).toContain('Marcos');
    await expect(view.locator('[data-testid="frames-toggle"]')).toHaveCount(1);

    // «Articulaciones» abierto no repite su título dentro del panel.
    const joints = page.locator('[data-testid="joint-sliders"]');
    await expect(joints.locator('[data-panel-title]')).toBeHidden();
    // Las etiquetas legibles de la ficha, con el id URDF como texto auxiliar (#535).
    await expect(joints.getByText('Articulación 1', { exact: true })).toBeVisible();
    await expect(joints.getByText('joint1', { exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const robot of ['planar2dof', 'so101']) {
    for (const viewport of [null, MOBILE_VIEWPORT]) {
      const width = viewport === null ? 'escritorio' : '390 px';
      test(`${robot} a ${width}: el brazo ocupa al menos la mitad del lienzo al abrir (#556)`, async ({
        page,
      }) => {
        if (viewport !== null) await page.setViewportSize(viewport);
        await openArm(page, robot);
        // Las mallas del SO-101 llegan después del URDF: se espera a que la medida se asiente.
        await expect
          .poll(async () => Math.min(...Object.values(await armFill(page))), {
            timeout: ISLAND_TIMEOUT_MS,
          })
          .toBeGreaterThanOrEqual(0.5);
        const fill = await armFill(page);
        // Y cabe entero: no llega a ninguno de los dos bordes.
        expect(fill.width).toBeLessThan(1);
        expect(fill.height).toBeLessThan(1);
      });
    }
  }

  test('cambiar de brazo en el selector actualiza la URL', async ({ page }) => {
    await openArm(page, 'planar2dof');

    await page.locator('[data-testid="arm-source-select"]').selectOption('so101');

    await expect(page).toHaveURL(/\?robot=so101$/);
    await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
      timeout: ISLAND_TIMEOUT_MS,
    });
  });
});
