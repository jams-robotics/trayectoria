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
