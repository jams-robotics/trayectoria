import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// F2-01a: visual regression of every widget section of the /dev/widgets playground.
// Light theme and the default viewport of the chromium project; no Supabase needed.
// `story` narrows the shot to one case: Plot animates in `Live` and `PlotStress`, so only the
// static case is comparable frame to frame (F2-01b, decision 8 of the assignment of #83).
// `shot` names the PNG when it is not the widget's own name (a second approved case).
const WIDGETS = [
  { name: 'ParamPanel' },
  { name: 'Formula' },
  { name: 'Plot', story: 'Static' },
  // Scene2D paints once per change with no continuous loop (F2-02a, decision 2 of the
  // assignment of #84), so the whole section is comparable frame to frame; `Primitives` is the
  // approved case of the ticket (grid, axes, two vectors, a trace, a circle, a rect, a label).
  { name: 'Scene2D', story: 'Primitives' },
  // The reference robot on the `oval` preset, captured paused at t = 0: the driver only advances
  // on «Reproducir», so the scene is static and comparable frame to frame (F2-02b, decision 6).
  { name: 'Scene2D', story: 'RobotOnTrack', shot: 'Scene2D-robot' },
  // SimControls is static too: the clock only moves while the simulation is running.
  { name: 'SimControls', story: 'Full', shot: 'SimControls' },
  // The «Explora» of T-0.2, the approved case of F2-03 (#86, decision 7). Both widgets paint on
  // a Scene2D, which repaints only on a change, so they are comparable frame to frame.
  { name: 'VectorWidget', story: 'Curriculum', shot: 'VectorWidget' },
  // The same body of T-2.1 on the 15° ramp of experiment 2 (#86, decision 7).
  { name: 'FreeBodyWidget', story: 'Ramp15', shot: 'FreeBodyWidget' },
  // The «Explora» of T-0.3 opened with the time marker at t = 2 s, the approved case of F2-04
  // (#87, decision 8). Its playback only advances on «Reproducir», so the three charts, the
  // tangent and the particle are static and comparable frame to frame.
  { name: 'KinematicsWidget', story: 'Curriculum03', shot: 'KinematicsWidget' },
  // The «Explora» of T-1.4 with the overlaid second launch, opened at t = 0.3 s: the approved
  // case of F2-05 (#88, decision 9). Its playback only advances on «Reproducir», so the scene
  // is static and comparable frame to frame.
  { name: 'ProjectileWidget', story: 'Launch', shot: 'ProjectileWidget' },
  // The «Explora» of T-4.2 opened at t = 0.15 s: the approved case of F2-06 (#89, decision 8).
  // Its playback only advances on «Reproducir», so the rolling wheel is static and comparable
  // frame to frame.
  { name: 'RotationWidget', story: 'Rolling', shot: 'RotationWidget' },
  // La «Explora» de T-3.1 abierta en t = 0.6 s: el caso aprobado de F2-07 (#90, decisión 7). El
  // cuerpo ya va por la rampa y las cuatro barras tienen valor, y como la reproducción solo
  // avanza con «Reproducir», la escena y las barras son comparables fotograma a fotograma.
  { name: 'EnergyWidget', story: 'Ramp', shot: 'EnergyWidget' },
  // El caso dorado de PowerWidget (#360) abierto en t = 1 s: la carga va a media subida y la
  // barra de E_p marca 4.32 J. La reproducción solo avanza con «Reproducir», así que la escena
  // y la barra son comparables fotograma a fotograma.
  { name: 'PowerWidget', story: 'Lift', shot: 'PowerWidget' },
  // La «Explora» de T-4.4 (tren 12:60 y 10:50) abierta en t = 0: el caso aprobado de F2-08
  // (#91, decisión 6). La reproducción solo avanza con «Reproducir», así que los cuatro
  // engranajes están quietos y la escena es comparable fotograma a fotograma.
  { name: 'GearWidget', story: 'TwoStage', shot: 'GearWidget' },
  // La «Explora» de T-5.2 (ω_L = 15, ω_R = 20 rad/s) abierta en t = 3 s: el caso aprobado de
  // F2-09a (#92, decisión 7). Lleva el CIR, el radio, los marcos, la traza y los vectores de
  // rueda, y como la reproducción solo avanza con «Reproducir», la escena es comparable
  // fotograma a fotograma.
  { name: 'DiffDriveWidget', story: 'Forward52', shot: 'DiffDriveWidget' },
  // La «Explora» de T-6.1 (línea centrada, lectura binaria y ruido σ = 0.03) en pausa en t = 0:
  // la muestra de ruido es la primera de la semilla fija, así que la escena, las barras y las
  // cifras son comparables fotograma a fotograma.
  { name: 'LineSensorWidget', story: 'Explora61', shot: 'LineSensorWidget' },
  // Los dos casos aprobados de F2-11 (#95, decisión 8): el formulario con el robot de
  // referencia y la tarjeta que lo resume. Ninguno de los dos anima ni pinta sobre un canvas,
  // así que son comparables fotograma a fotograma. La story `Live` no se captura: lleva un
  // DiffDriveWidget que el e2e de my-robot.spec.ts mueve.
  { name: 'MyRobotWidget', story: 'Form', shot: 'MyRobotWidget-form' },
  { name: 'MyRobotWidget', story: 'Card', shot: 'MyRobotWidget-card' },
  // El caso aprobado de F2-12 (#96, decisión 7): rejilla, la tríada de ejes del origen con su
  // etiqueta y una caja, con `up: 'z'`. Es la única captura sobre WebGL, así que se compara con
  // `maxDiffPixelRatio` (ver abajo): el renderizado de three en Chromium headless no es
  // idéntico píxel a píxel entre máquinas. La escena no anima: no hay bucle de render más allá
  // del que dispara la órbita, y nadie la orbita durante la captura.
  { name: 'Scene3D', story: 'Basic', shot: 'Scene3D' },
] as const;

/**
 * Widgets pintados sobre WebGL: su canvas se espera con la comprobación de más abajo y su
 * captura admite una diferencia mínima (#96, decisión 7).
 */
const WEBGL_WIDGETS: readonly string[] = ['Scene3D'];

/** Diferencia admitida en las capturas de WebGL, en fracción de píxeles del recorte. */
const WEBGL_MAX_DIFF_PIXEL_RATIO = 0.02;

/** Widgets drawn on a `Scene2D`: their canvas needs the measure-and-paint wait below. */
const SCENE_WIDGETS: readonly string[] = [
  'Scene2D',
  'VectorWidget',
  'FreeBodyWidget',
  'KinematicsWidget',
  'ProjectileWidget',
  'RotationWidget',
  'EnergyWidget',
  'PowerWidget',
  'GearWidget',
  'DiffDriveWidget',
  'LineSensorWidget',
];

/** Default width of a `<canvas>` with no `width` attribute yet; a scene past it has been sized. */
const INTRINSIC_CANVAS_WIDTH_PX = 300;

/**
 * Opens the playground in the light theme. With `section` the page renders only that widget's
 * section (#108, decision 2): every capture is then taken over a page that holds nothing but
 * its own widget, so adding a story to another widget no longer shifts it down the page and
 * invalidates its snapshot (spec gap #117). Without it the whole catalogue is rendered, which
 * is what the interaction tests below need.
 *
 * The gallery is a `client:only` island (QA #108, PR #140: with SSR, `Astro.url.searchParams`
 * never saw the query string and every section rendered regardless of it), so there is no `ssr`
 * attribute to wait out — the DOM is simply empty until React mounts. Waiting for a `[data-story]`
 * to become visible is the equivalent hydration gate for this page.
 */
async function openPlayground(page: Page, section?: string): Promise<void> {
  // With nothing stored, the inline script of Base.astro follows the system preference; the
  // snapshots are approved in the light theme (decision of the assignment comment of #82).
  await page.emulateMedia({ colorScheme: 'light' });
  const query = section === undefined ? '' : `?section=${encodeURIComponent(section)}`;
  await page.goto(`/dev/widgets${query}`);
  // The Astro dev toolbar floats over the page in `astro dev`; it is not part of any widget.
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  await expect(page.locator('[data-story]').first()).toBeVisible();
  if (section !== undefined) {
    // The whole point of the filter (#108, decision 2): only the requested widget's section
    // is in the DOM, so this page never moves when a story is added to another widget.
    await expect(page.locator('[data-widget]')).toHaveCount(1);
    await expect(page.locator('[data-widget]')).toHaveAttribute('data-widget', section);
  }
  // Fonts settle before the screenshot, otherwise the fallback face is captured.
  await page.evaluate(() => document.fonts.ready);
}

for (const widget of WIDGETS) {
  const story = 'story' in widget ? widget.story : undefined;
  const shot = 'shot' in widget ? widget.shot : widget.name;
  test(`${shot} looks as approved`, async ({ page }) => {
    await openPlayground(page, widget.name);
    const section = page.locator(`[data-widget="${widget.name}"]`);
    const target = story === undefined ? section : section.locator(`[data-story="${story}"]`);
    await expect(target).toBeVisible();
    // Plot loads uPlot lazily (it needs a browser), so the canvas appears one tick after the
    // card: without this the shot would catch an empty chart area (F2-01b).
    if (widget.name === 'Plot') await expect(target.locator('canvas')).toBeVisible();
    // KinematicsWidget draws on a Scene2D and on three lazily loaded uPlot charts: wait for
    // all four canvases, or the shot catches the charts still empty (F2-04).
    if (widget.name === 'KinematicsWidget') {
      await expect(target.locator('canvas')).toHaveCount(4);
    }
    // Scene2D measures its container with a `ResizeObserver` and then paints inside a
    // `requestAnimationFrame`, so the canvas is still at its intrinsic 300 x 150 and blank when
    // it first becomes visible: wait until it has been resized to its container and painted.
    if (SCENE_WIDGETS.includes(widget.name)) {
      // A widget may draw on more than one canvas (KinematicsWidget has a scene and three
      // charts); the scene is the one inside `[data-testid="scene2d"]`.
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
    }
    // Scene3D llega en un chunk aparte con `React.lazy` para que `three` no entre en el bundle
    // de las páginas de tema (#96, decisión 2): su sección aparece un tick después del resto, y
    // el canvas de WebGL necesita un fotograma más para tener la escena dibujada.
    if (WEBGL_WIDGETS.includes(widget.name)) {
      const canvas = target.locator('canvas');
      await expect(canvas).toBeVisible();
      // La escena se declara con `preserveDrawingBuffer`, así que el búfer sobrevive al
      // fotograma en el que se dibujó y la captura lo recoge. Se espera a que haya píxeles
      // dibujados de verdad —no solo a que el canvas esté dimensionado—, porque el chunk de
      // Scene3D llega con `React.lazy` y three necesita un fotograma más para el primer
      // render; leer el búfer aquí además fuerza la composición antes de la captura.
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
      await expect(target).toHaveScreenshot(`${shot}.png`, {
        maxDiffPixelRatio: WEBGL_MAX_DIFF_PIXEL_RATIO,
      });
      return;
    }
    await expect(target).toHaveScreenshot(`${shot}.png`);
  });
}

// F2-02b, QA round 1: unit tests mocked requestAnimationFrame and passed while the real browser
// looked frozen. "Paso" was the reproducible half of that report — the story used a dt_s too
// small for the clock's two decimals to show a single step — so this checks both controls
// against the real clock text, not a mock.
test('RobotOnTrack: Reproducir advances the clock and Paso moves it by one step', async ({
  page,
}) => {
  await openPlayground(page);
  const story = page.locator('[data-widget="Scene2D"] [data-story="RobotOnTrack"]');
  const clock = story.locator('[data-testid="sim-clock"]');
  await expect(clock).toHaveText(/00\.00/);

  // The island hydrates asynchronously after the SSR markup is already in the DOM (F2-01a,
  // ronda 1): a click that lands before React attaches its handlers is silently a no-op, and a
  // single check right after it cannot tell a dropped click from a real bug. Retrying the click
  // survives that window without weakening what it proves: once it succeeds, the clock has
  // genuinely moved off `00.00`.
  const stepButton = story.getByRole('button', { name: /paso/i });
  await expect
    .poll(
      async () => {
        await stepButton.click();
        return clock.textContent();
      },
      { message: 'Paso should move the clock off 00.00 once the island is hydrated' },
    )
    .not.toMatch(/00\.00/);

  await story.getByRole('button', { name: /reiniciar/i }).click();
  await expect(clock).toHaveText(/00\.00/);

  await story.getByRole('button', { name: /reproducir/i }).click();
  await expect.poll(async () => clock.textContent()).not.toMatch(/00\.00/);
});

// QA de PR #110, ronda 1: en la story Disc, «Reproducir» parecía no arrancar la animación (el
// reloj quedaba en 00.00 y «Pausa» seguía deshabilitado). La causa no era del modo disc sino la
// misma carrera de hidratación de la nota de arriba — Disc es la primera story del playground
// (order de RotationWidget.stories.tsx), así que un clic en «Reproducir» nada más cargar la
// página es el caso más propenso a llegar antes de que React conecte el manejador. Se reintenta
// el clic como con «Paso» de RobotOnTrack, en vez de solo reintentar la lectura del reloj.
test('Disc: Reproducir advances the clock even right after the page loads', async ({ page }) => {
  await openPlayground(page);
  const story = page.locator('[data-widget="RotationWidget"] [data-story="Disc"]');
  const clock = story.locator('[data-testid="sim-clock"]');
  await expect(clock).toHaveText(/00\.00/);

  const playButton = story.getByRole('button', { name: /reproducir/i });
  await expect
    .poll(
      async () => {
        await playButton.click();
        return clock.textContent();
      },
      { message: 'Reproducir should move the clock off 00.00 once the island is hydrated' },
    )
    .not.toMatch(/00\.00/);

  await story.getByRole('button', { name: /pausa/i }).click();
});

test('the playground renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await openPlayground(page);
  // Waiting for the element to be visible is not enough: a hydration mismatch discards and
  // re-renders the client tree asynchronously, after the initial paint (F2-01a, ronda 1). Wait
  // for the slider to actually respond to input, which only happens once React has attached its
  // event handlers post-hydration, before asserting no console/pageerror was raised.
  const slider = page.locator('[data-widget="ParamPanel"] input[type="range"]').first();
  await expect(slider).toBeVisible();
  const initialValue = await slider.inputValue();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).not.toHaveValue(initialValue);
  expect(errors).toEqual([]);
});

// F2-10 (#94, decisión 7): las dos capturas aprobadas del ExerciseWidget son sus estados de
// resultado, no el pendiente, así que se responde antes de disparar el tiro. La story `Scalar`
// va con semilla fija, de modo que el enunciado y el porcentaje son los mismos en cada corrida.
const EXERCISE_ANSWER_S = 7.608258 / 0.392499;

/** Responde en la story `Scalar` del playground y devuelve su tarjeta ya verificada. */
async function answerScalar(page: Page, response_s: number): Promise<Locator> {
  await openPlayground(page, 'ExerciseWidget');
  const story = page.locator('[data-widget="ExerciseWidget"] [data-story="Scalar"]');
  const field = story.getByRole('textbox');
  await expect(field).toBeVisible();
  // `openPlayground` ya esperó a que el primer `[data-story]` fuera visible, lo que en un
  // island `client:only` (QA #108, PR #140) ya implica que React lo hidrató: no hay atributo
  // `ssr` que esperar aquí.
  await expect
    .poll(async () => {
      await field.fill(String(response_s));
      return field.inputValue();
    })
    .toBe(String(response_s));
  // El clic también puede llegar antes de que React conecte el manejador, así que se reintenta
  // hasta que aparece la línea de resultado (misma carrera que en «Paso» de RobotOnTrack).
  const verify = story.getByRole('button', { name: 'Comprobar' });
  const resultLine = story.getByTestId('exercise-result');
  await expect
    .poll(async () => {
      await verify.click();
      return resultLine.count();
    })
    .toBeGreaterThan(0);
  return story;
}

// F2-09b (#93, decisión 4): la «Explora» de T-5.4 abierta en t = 10 s. La captura se toma con
// el radio creído en 0.033 m, un milímetro por encima del real, que es lo que separa la traza
// estimada de la real; con la calibración exacta las dos se superpondrían y la captura no
// probaría nada. La reproducción solo avanza con «Reproducir», así que la escena está quieta.
test('DiffDriveWidget-odometry looks as approved', async ({ page }) => {
  await openPlayground(page, 'DiffDriveWidget');
  const story = page.locator('[data-widget="DiffDriveWidget"] [data-story="Odometry54"]');
  await expect(story).toBeVisible();
  // `openPlayground` ya esperó a que el primer `[data-story]` fuera visible, lo que en un
  // island `client:only` (QA #108, PR #140) ya implica que React lo hidrató: no hay atributo
  // `ssr` que esperar aquí.
  const believedRadius = story.getByRole('textbox', { name: /Radio de rueda creído/ });
  await expect
    .poll(async () => {
      await believedRadius.fill('0.033');
      await believedRadius.press('Enter');
      return believedRadius.inputValue();
    })
    .toBe('0.033');
  const canvas = story.locator('[data-testid="scene2d"] canvas');
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
  await expect(story).toHaveScreenshot('DiffDriveWidget-odometry.png');
});

// #394 (T-5.5): la «Explora» de T-5.5 con la «Maniobra en tres movimientos» activada. Conmutarla
// reinicia la carrera en pausa en t = 0, así que la escena está quieta: el panel muestra la fase
// «1 · Girar», la duración 4.14 s y los sliders «Giro» y «Avance» en lugar de v y ω. Tras la
// captura, «Reproducir» recorre la maniobra y se pausa sola al terminar, en (0, 0.2 m, 0°).
test('DiffDriveWidget-maneuver looks as approved', async ({ page }) => {
  await openPlayground(page, 'DiffDriveWidget');
  const story = page.locator('[data-widget="DiffDriveWidget"] [data-story="Maneuver55"]');
  await expect(story).toBeVisible();
  const toggle = story.getByRole('button', { name: 'Maniobra en tres movimientos' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(story.getByRole('slider', { name: /^Giro/ })).toBeVisible();
  const canvas = story.locator('[data-testid="scene2d"] canvas');
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () =>
      canvas.evaluate(
        (element: HTMLCanvasElement, intrinsicWidth_px: number) =>
          element.width > intrinsicWidth_px,
        INTRINSIC_CANVAS_WIDTH_PX,
      ),
    )
    .toBe(true);
  await expect(story).toHaveScreenshot('DiffDriveWidget-maneuver.png');

  const row = (term: string): Locator =>
    story
      .locator('dt', { hasText: new RegExp(`^${term}$`) })
      .locator('xpath=following-sibling::dd[1]');
  await story.getByRole('button', { name: 'Reproducir' }).click();
  await expect(row('Fase')).toHaveText('Terminada', { timeout: 15_000 });
  await expect(story.getByRole('button', { name: 'Reproducir' })).toBeVisible();
  await expect(row('Posición x')).toHaveText('0.00 m');
  await expect(row('Posición y')).toHaveText('0.200 m');
  await expect(row('Orientación')).toHaveText('0.00 °');
});

test('ExerciseWidget looks as approved', async ({ page }) => {
  const story = await answerScalar(page, EXERCISE_ANSWER_S);
  await expect(story.getByTestId('exercise-result')).toContainText('Correcto');
  await expect(story).toHaveScreenshot('ExerciseWidget.png');
});

test('ExerciseWidget-incorrect looks as approved', async ({ page }) => {
  const story = await answerScalar(page, 1.1 * EXERCISE_ANSWER_S);
  await expect(story.getByTestId('exercise-result')).toContainText('Incorrecto · fuera por 10.0 %');
  await expect(story).toHaveScreenshot('ExerciseWidget-incorrect.png');
});

// F2-13 (#97, decisión 7): la página de tema completa, en escritorio y a 390 px, sobre el tema de
// prueba de /dev/tema (#255): así la captura no cambia cada vez que se escribe un tema real.
// Referencia de diseño: docs/design/03-tema-claro.png y 07-tema-movil-claro.png.
const TOPIC_URL = '/dev/tema';
const TOPIC_MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Abre el tema de prueba en tema claro y con las fuentes, las fórmulas y las islas ya pintadas. */
async function openTopic(page: Page): Promise<void> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(TOPIC_URL);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  // Las islas son `client:only` salvo el `ExerciseWidget` (`client:visible`): sin esperar a que
  // Astro las monte, la captura recogería los bloques vacíos (misma carrera que en /dev/widgets).
  // Son tres bloques de fórmula: el de `Formulas` y los dos de `RobotFormula` (la forma simbólica
  // y la sustituida). Cada isla `client:only` carga su widget por `import()`, así que se les da
  // más margen que el de un `expect` por defecto.
  await expect(page.locator('[role="math"]')).toHaveCount(3, { timeout: 15_000 });
  await expect(page.getByTestId('my-robot-form')).toBeVisible();
  await expect(page.getByTestId('exercise')).toBeVisible();
  // `ProgressNotice` (#146) solo se pinta cuando `$sessionReady` es cierto y no hay sesión: sin
  // esperarlo, la captura corre la misma carrera y a veces sale sin el aviso (49 px de menos).
  await expect(page.getByTestId('progress-notice')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/**
 * Lo que no es comparable fotograma a fotograma: el disco de `RotationWidget`, que anima, y el
 * enunciado del ejercicio, cuyos números salen de la semilla anónima que se sortea al hidratar.
 */
function unstable(page: Page) {
  return [
    page.locator('[data-topic-widget="RotationWidget"]'),
    page.getByTestId('exercise-statement'),
  ];
}

test('Tema looks as approved', async ({ page }) => {
  await openTopic(page);
  await expect(page).toHaveScreenshot('Tema.png', { fullPage: true, mask: unstable(page) });
});

test('Tema-mobile looks as approved', async ({ page }) => {
  await page.setViewportSize(TOPIC_MOBILE_VIEWPORT);
  await openTopic(page);
  await expect(page).toHaveScreenshot('Tema-mobile.png', { fullPage: true, mask: unstable(page) });
});
