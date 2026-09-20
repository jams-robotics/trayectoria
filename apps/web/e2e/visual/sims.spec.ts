import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-01b (#126, decisión 9): regresión visual de las cuatro stories de preset del editor de
// pista en /dev/sims. Tema claro y viewport por defecto del proyecto chromium; sin Supabase.
// Ninguna anima —Scene2D pinta una vez por cambio y no hay bucle continuo (#84, decisión 2)—,
// así que son comparables fotograma a fotograma.
const STORIES = [
  { story: 'Oval', shot: 'TrackEditor-oval' },
  { story: 'SCurve', shot: 'TrackEditor-s' },
  { story: 'TightCurves', shot: 'TrackEditor-tight' },
  { story: 'Crossing', shot: 'TrackEditor-cross' },
] as const;

/** Sección de /dev/sims que se captura. */
const SECTION = 'TrackEditor';

/** Ancho por defecto de un `<canvas>` sin atributo `width`; pasado de ahí ya fue dimensionado. */
const INTRINSIC_CANVAS_WIDTH_PX = 300;

/**
 * Abre el playground de sims en tema claro, filtrado a una sección. Con el filtro la captura se
 * toma sobre una página que solo lleva su propio componente, de modo que añadir una story a otro
 * no la desplaza ni invalida su instantánea (#108, decisión 2; spec gap #117).
 *
 * La galería es una isla `client:only`, así que no hay pasada de SSR que esperar: el DOM está
 * vacío hasta que React monta, y esperar a que un `[data-story]` sea visible es la puerta de
 * hidratación equivalente para esta página.
 */
async function openPlayground(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/dev/sims?section=${SECTION}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.locator('[data-story]').first()).toBeVisible();
  await expect(page.locator('[data-section]')).toHaveCount(1);
  await expect(page.locator('[data-section]')).toHaveAttribute('data-section', SECTION);
  // Las fuentes se asientan antes de la captura; si no, se recoge la de reserva.
  await page.evaluate(() => document.fonts.ready);
}

for (const { story, shot } of STORIES) {
  test(`${shot} looks as approved`, async ({ page }) => {
    await openPlayground(page);
    const target = page.locator(`[data-section="${SECTION}"] [data-story="${story}"]`);
    await expect(target).toBeVisible();
    // Scene2D mide su contenedor con un `ResizeObserver` y pinta dentro de un
    // `requestAnimationFrame`: al hacerse visible el lienzo sigue en 300 × 150 y en blanco, así
    // que se espera a que esté dimensionado y con píxeles pintados de verdad.
    const canvas = target.locator('[data-testid="scene2d"] canvas');
    await expect(canvas).toBeVisible();
    await expect
      .poll(async () =>
        canvas.evaluate((element: HTMLCanvasElement, intrinsicWidth_px: number) => {
          const ctx = element.getContext('2d');
          if (ctx === null || element.width <= intrinsicWidth_px) return 0;
          const { data } = ctx.getImageData(0, 0, element.width, element.height);
          let painted = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) painted += 1;
          }
          return painted;
        }, INTRINSIC_CANVAS_WIDTH_PX),
      )
      .toBeGreaterThan(0);
    await expect(target).toHaveScreenshot(`${shot}.png`);
  });
}

// F4-02a (#127, decisión 10): regresión visual de la story `Oval` de `LineFollowerWidget` en
// /dev/sims. La story arranca pausada en `t = 0` con el PID de referencia, así que la escena no
// anima y la captura es comparable fotograma a fotograma, igual que las del editor de pista.
const LINE_FOLLOWER_SECTION = 'LineFollowerWidget';

test('LineFollowerWidget looks as approved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/dev/sims?section=${LINE_FOLLOWER_SECTION}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.locator('[data-story]').first()).toBeVisible();
  await expect(page.locator('[data-section]')).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);

  const target = page.locator(`[data-section="${LINE_FOLLOWER_SECTION}"] [data-story="Oval"]`);
  await expect(target).toBeVisible();
  // El reloj a `00.00` es la puerta de «el modelo ya publicó su estado inicial»; el lienzo se
  // espera pintado por la misma razón que en las capturas del editor.
  await expect(target.locator('[data-testid="line-follower-t"]')).toHaveText('0.00 s');
  const canvas = target.locator('[data-testid="scene2d"] canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate((element: HTMLCanvasElement, intrinsicWidth_px: number) => {
        const ctx = element.getContext('2d');
        if (ctx === null || element.width <= intrinsicWidth_px) return 0;
        const { data } = ctx.getImageData(0, 0, element.width, element.height);
        let painted = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) painted += 1;
        }
        return painted;
      }, INTRINSIC_CANVAS_WIDTH_PX),
    )
    .toBeGreaterThan(0);
  await expect(target).toHaveScreenshot('LineFollowerWidget.png');
});

// F5-01a (#133, decisión 9): regresión visual de la story `Planar` de `ArmViewer` en /dev/sims.
// Es una captura sobre WebGL, así que se compara con `maxDiffPixelRatio`: el renderizado de
// three en Chromium headless no es idéntico píxel a píxel entre máquinas (mismo criterio que
// `Scene3D` en F2-12, #96, decisión 7). La escena no anima: no hay bucle de render más allá del
// que dispara la órbita, y nadie la orbita durante la captura.
const ARM_SECTION = 'ArmViewer';

/** Diferencia admitida en las capturas de WebGL, en fracción de píxeles del recorte. */
const WEBGL_MAX_DIFF_PIXEL_RATIO = 0.02;

/** Margen para la sección perezosa: su chunk arrastra three y urdf-loader. */
const LAZY_SECTION_TIMEOUT_MS = 30_000;

test('ArmViewer looks as approved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(`/dev/sims?section=${ARM_SECTION}`);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  // La sección llega con `React.lazy` para que `three` y `urdf-loader` no entren en el chunk
  // principal (#133, decisión 2). En `astro dev` ese chunk se transforma en la primera visita,
  // así que aparece bastante después que el resto de la galería y necesita más margen que el
  // tiempo de espera por defecto.
  await expect(page.locator(`[data-section="${ARM_SECTION}"]`)).toBeVisible({
    timeout: LAZY_SECTION_TIMEOUT_MS,
  });
  await page.evaluate(() => document.fonts.ready);

  const target = page.locator(`[data-section="${ARM_SECTION}"] [data-story="Planar"]`);
  await expect(target).toBeVisible();
  // El panel del efector se rellena cuando el URDF ya está cargado y sim-core ha resuelto la
  // pose: es la puerta de «el visor está listo» sin depender del canvas.
  await expect(target.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
    timeout: LAZY_SECTION_TIMEOUT_MS,
  });

  const canvas = target.locator('canvas');
  await expect(canvas).toBeVisible();
  // `preserveDrawingBuffer` mantiene el búfer más allá del fotograma en que se dibujó, así que
  // la captura lo recoge; leerlo aquí además fuerza la composición antes de la captura.
  await expect
    .poll(async () =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        if (element.width === 0) return 0;
        const copy = document.createElement('canvas');
        copy.width = element.width;
        copy.height = element.height;
        const ctx = copy.getContext('2d');
        if (ctx === null) return 0;
        ctx.drawImage(element, 0, 0);
        const { data } = ctx.getImageData(0, 0, copy.width, copy.height);
        let painted = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) painted += 1;
        }
        return painted;
      }),
    )
    .toBeGreaterThan(0);
  await expect(target).toHaveScreenshot('ArmViewer.png', {
    maxDiffPixelRatio: WEBGL_MAX_DIFF_PIXEL_RATIO,
    // Playwright repite la captura hasta que dos consecutivas coinciden: sobre WebGL eso puede
    // tardar más que el tiempo por defecto, porque el brazo aparece cuando la malla ya está
    // cargada y el primer fotograma de three llega después.
    timeout: LAZY_SECTION_TIMEOUT_MS,
  });
});
