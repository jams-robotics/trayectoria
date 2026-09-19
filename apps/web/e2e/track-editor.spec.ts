import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F4-01b (#126): el editor de pista sobre la story `Empty` de /dev/sims. No necesita Supabase.
// El dibujo se hace con el ratón sobre el lienzo del Scene2D, que es donde vive la conversión
// px → m; los tests de Vitest del paquete cubren el modelo y el panel numérico.

/** Story sobre la que se dibuja: el editor abierto sobre una pista vacía. */
const STORY = 'Empty';

/** Ancho visible del lienzo del editor, en metros (`WORLD_WIDTH_M` de TrackEditor.tsx). */
const WORLD_WIDTH_M = 1.8;

/** Punto del mundo en el centro del lienzo (`SCENE_CENTER_M` de TrackEditor.tsx). */
const SCENE_CENTER_M: Point_m = [0.475, 0.05];

/** Ancho por defecto de un `<canvas>` sin atributo `width`; pasado de ahí ya fue dimensionado. */
const INTRINSIC_CANVAS_WIDTH_PX = 300;

/** Un punto del mundo en metros. */
type Point_m = readonly [number, number];

/**
 * Abre la galería de sims filtrada a la sección del editor y devuelve la story pedida. La isla
 * es `client:only` (decisión 2 de #126), así que el DOM está vacío hasta que React monta:
 * esperar a que un `[data-story]` sea visible es la puerta de hidratación de esta página.
 */
async function openEditor(page: Page): Promise<Locator> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/dev/sims?section=TrackEditor');
  // La barra de herramientas de Astro flota sobre la página en `astro dev`.
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.locator('[data-story]').first()).toBeVisible();
  const story = page.locator(`[data-section="TrackEditor"] [data-story="${STORY}"]`);
  await expect(story).toBeVisible();
  // Scene2D mide su contenedor con un `ResizeObserver` y pinta dentro de un
  // `requestAnimationFrame`: hasta que no lo hace, el lienzo sigue en su tamaño intrínseco y la
  // conversión px → m no tiene medidas con las que trabajar.
  const canvas = story.locator('[data-testid="scene2d"] canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate((element: HTMLCanvasElement) => element.getBoundingClientRect().width),
    )
    .toBeGreaterThan(INTRINSIC_CANVAS_WIDTH_PX);
  // El lienzo mide más que el viewport en esta página, así que sin traerlo a la vista los
  // puntos del arrastre caen fuera de la ventana y el ratón no acierta a nada: `page.mouse`
  // trabaja en píxeles de viewport, no de documento.
  await canvas.scrollIntoViewIfNeeded();
  return story;
}

/** Píxeles de pantalla del punto `p_m` del mundo, con el mismo mapeo que usa el editor. */
async function toScreen(story: Locator, p_m: Point_m): Promise<{ x: number; y: number }> {
  const box = await story.locator('[data-testid="scene2d"] canvas').boundingBox();
  if (box === null) throw new Error('el lienzo no tiene caja');
  const pxPerM = box.width / WORLD_WIDTH_M;
  return {
    x: box.x + box.width / 2 + (p_m[0] - SCENE_CENTER_M[0]) * pxPerM,
    y: box.y + box.height / 2 - (p_m[1] - SCENE_CENTER_M[1]) * pxPerM,
  };
}

/** Arrastra del punto `from` al punto `to` del mundo, pasando por `mid` si se da. */
async function drag(story: Locator, from: Point_m, to: Point_m, mid?: Point_m): Promise<void> {
  const page = story.page();
  const start = await toScreen(story, from);
  const end = await toScreen(story, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (mid !== undefined) {
    const through = await toScreen(story, mid);
    await page.mouse.move(through.x, through.y, { steps: 4 });
  }
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await page.mouse.up();
}

/** Selecciona una herramienta de la barra segmentada. */
async function useTool(story: Locator, name: string): Promise<void> {
  const tool = story.getByRole('radio', { name });
  // La isla hidrata de forma asíncrona: un clic que llegue antes de que React conecte el
  // manejador es un no-op silencioso, así que se reintenta hasta que la herramienta queda activa
  // (misma carrera que documenta e2e/visual/widgets.spec.ts).
  await expect
    .poll(async () => {
      await tool.click();
      return tool.getAttribute('aria-checked');
    })
    .toBe('true');
}

/**
 * Dibuja el cuadrado redondeado del criterio: dos rectas y dos arcos encadenados, cada trazo
 * empezando dentro del radio de snap (20 mm) del final del anterior, y el último cerrando sobre
 * el inicio del primero.
 */
async function drawClosedTrack(story: Locator): Promise<void> {
  await useTool(story, 'Recta');
  await drag(story, [0.2, -0.1], [0.6, -0.1]);
  await useTool(story, 'Arco');
  await drag(story, [0.605, -0.1], [0.6, 0.3], [0.8, 0.1]);
  await useTool(story, 'Recta');
  await drag(story, [0.6, 0.305], [0.2, 0.3]);
  await useTool(story, 'Arco');
  await drag(story, [0.195, 0.3], [0.2, -0.1], [0, 0.1]);
}

test('dibujar dos rectas y dos arcos encadenados deja la pista continua y cerrada', async ({
  page,
}) => {
  const story = await openEditor(page);
  await drawClosedTrack(story);

  const segments = story.getByRole('list', { name: 'Segmentos de la pista' }).getByRole('button');
  await expect(segments).toHaveCount(4);
  const notice = story.getByTestId('track-editor-continuity');
  await expect(notice).toContainText('Pista continua');
  await expect(notice).not.toContainText('Pista abierta');

  // «Deshacer» quita el último arco: la pista deja de estar cerrada y lo anuncia.
  await story.getByRole('button', { name: 'Deshacer' }).click();
  await expect(segments).toHaveCount(3);
  await expect(notice).toContainText('Pista abierta');
});

test('Guardar descarga un JSON con los cuatro segmentos que parseTrack acepta', async ({
  page,
}) => {
  const story = await openEditor(page);
  await drawClosedTrack(story);

  const download = page.waitForEvent('download');
  await story.getByRole('button', { name: 'Guardar' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('pista.json');

  const path = await file.path();
  const json = await readFile(path, 'utf8');
  // El validador del formato es `parseTrack` de sim-core, que `apps/web` no puede importar
  // (docs/ARCHITECTURE.md §2) y que el cargador de Playwright tampoco resuelve a través de
  // `@trayectoria/sims` (arrastra los JSON de i18n). Se ejecuta donde ya está cargado: en la
  // página, a través del `Cargar` del propio editor, que usa `fromJson` → `parseTrack`. Si el
  // archivo se acepta y reaparecen los cuatro segmentos en el mismo orden, `parseTrack` lo
  // aceptó; si no, el aviso de error del editor lo delata.
  await story.getByLabel('Archivo de pista en JSON').setInputFiles({
    name: 'pista.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf8'),
  });
  await expect(story.getByTestId('track-editor-error')).toHaveCount(0);
  const reloaded = story.getByRole('list', { name: 'Segmentos de la pista' }).getByRole('button');
  await expect(reloaded).toHaveCount(4);
  await expect(reloaded.nth(0)).toHaveAccessibleName('Segmento 1: recta');
  await expect(reloaded.nth(1)).toHaveAccessibleName('Segmento 2: arco');
  await expect(reloaded.nth(2)).toHaveAccessibleName('Segmento 3: recta');
  await expect(reloaded.nth(3)).toHaveAccessibleName('Segmento 4: arco');
});

test('cargar un JSON inválido muestra el error y no cambia la pista', async ({ page }) => {
  const story = await openEditor(page);
  await useTool(story, 'Recta');
  await drag(story, [0.2, 0.1], [0.8, 0.1]);
  const segments = story.getByRole('list', { name: 'Segmentos de la pista' }).getByRole('button');
  await expect(segments).toHaveCount(1);

  await story.getByLabel('Archivo de pista en JSON').setInputFiles({
    name: 'pista.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ esto no es una pista', 'utf8'),
  });

  const error = story.getByTestId('track-editor-error');
  await expect(error).toBeVisible();
  await expect(error).toContainText('no es una pista válida');
  // La pista sigue siendo la que había: el archivo malo no la tocó.
  await expect(segments).toHaveCount(1);
});
