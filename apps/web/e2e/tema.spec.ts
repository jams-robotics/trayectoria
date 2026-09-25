import { expect, test, type Locator, type Page } from '@playwright/test';

import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };
import route from '../../../content/es/ruta-1/ruta.json' with { type: 'json' };

// F2-13 acceptance criteria, with no session, on the topic fixture of /dev/tema (#255): the
// layout is checked on a page whose content does not change when a real topic is written, and
// its only Verifica exercise falls back to its null progress adapter (#97, decisión 7).
const TOPIC_URL = '/dev/tema';
const SECTIONS = common.topic.sections;

/** Las 7 anclas de docs/CONTENT-STANDARDS.md §2, en orden. */
const SECTION_IDS = [
  'gancho',
  'concepto',
  'formulas',
  'explora',
  'al-robot',
  'verifica',
  'profundiza',
] as const;

/** Los títulos i18n de esas mismas secciones, en el mismo orden. */
const SECTION_TITLES = [
  SECTIONS.gancho,
  SECTIONS.concepto,
  SECTIONS.formulas,
  SECTIONS.explora,
  SECTIONS.alRobot,
  SECTIONS.verifica,
  SECTIONS.profundiza,
] as const;

/** Orden plano de los temas de ruta.json: el fixture ocupa el lugar del primero. */
const ORDERED = route.modules.flatMap((module) => module.topics);
const MOBILE = { width: 390, height: 844 };
/** Margen para que la sesión anónima se lea antes de que llegue el módulo de `ProgressNotice`. */
const NOTICE_MODULE_DELAY_MS = 500;

async function openTopic(page: Page): Promise<void> {
  await page.goto(TOPIC_URL);
  // `.first()`: in `astro dev` the dev toolbar adds its own `h1`s after the page's.
  await expect(page.locator('h1').first()).toBeVisible();
}

test('las 7 secciones existen, en el orden del estándar', async ({ page }) => {
  await openTopic(page);
  const sections = page.locator('[data-section]');
  await expect(sections).toHaveCount(SECTION_IDS.length);
  expect(await sections.evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual([
    ...SECTION_IDS,
  ]);
  // El `h2` lleva el número mono delante del título (docs/design/03-tema-claro.png), así que se
  // comprueba que lo contiene, no que es exactamente igual.
  for (const [index, id] of SECTION_IDS.entries()) {
    await expect(page.locator(`#${id} h2`)).toContainText(SECTION_TITLES[index] ?? '');
  }
});

test('cada enlace del índice lateral lleva a su sección', async ({ page }) => {
  await openTopic(page);
  const outline = page.locator('[data-outline="desktop"]');
  await expect(outline).toBeVisible();

  for (const [index, id] of SECTION_IDS.entries()) {
    const link = outline.locator(`[data-outline-link="${id}"]`);
    await expect(link).toHaveText(SECTION_TITLES[index] ?? '');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${TOPIC_URL}#${id}$`));
    await expect(page.locator(`#${id}`)).toBeInViewport();
  }
});

test('anterior y siguiente siguen el orden de ruta.json', async ({ page }) => {
  await openTopic(page);
  const pagination = page.getByRole('navigation', { name: common.topic.pagination });

  // El fixture ocupa el lugar del primer tema de la ruta: no tiene anterior, y su siguiente, el
  // segundo de ruta.json, aparece sin enlace, como un tema todavía no publicado.
  await expect(pagination.getByText(common.topic.previous)).toHaveCount(0);
  await expect(pagination.getByText(ORDERED[1]?.title ?? '')).toBeVisible();
  await expect(pagination.getByRole('link')).toHaveCount(0);
});

test('la cabecera muestra tiempo, prerrequisitos y el progreso 0/N de la ruta', async ({
  page,
}) => {
  await openTopic(page);
  await expect(page.getByText('20 min')).toBeVisible();
  await expect(page.getByText(common.topic.noPrerequisites)).toBeVisible();
  await expect(page.getByTestId('route-progress')).toHaveText(`0/${ORDERED.length}`);
});

test('a 390 px el índice está plegado y se despliega', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await openTopic(page);

  await expect(page.locator('[data-outline="desktop"]')).toBeHidden();
  const outline = page.locator('[data-outline="mobile"]');
  await expect(outline).toBeVisible();
  await expect(outline).not.toHaveAttribute('open', '');
  await expect(outline.locator('[data-outline-link="gancho"]')).toBeHidden();

  await outline.getByText(common.topic.outline).click();
  await expect(outline).toHaveAttribute('open', '');
  await expect(outline.locator('[data-outline-link="gancho"]')).toBeVisible();
});

test('Profundiza resuelve la clave del frontmatter a su referencia completa', async ({ page }) => {
  await openTopic(page);
  const reference = page.locator('[data-reference="young-freedman-1"]');
  await expect(reference).toBeVisible();
  await expect(reference).toContainText('Young, H. D., Freedman, R. A. (con Ford, A. L.)');
  await expect(reference).toContainText('Unidades, cantidades físicas y vectores');
});

test('Verifica monta un ExerciseWidget por ejercicio declarado', async ({ page }) => {
  await openTopic(page);
  const exercises = page.getByTestId('exercise');
  await expect(exercises).toHaveCount(1);
  await expect(exercises.first()).toHaveAttribute('data-status', 'pending');
});

test('Verifica se hidrata y responde sin errores de página', async ({ page }) => {
  // La isla resuelve la clave del ejercicio en el cliente (#97, hallazgo alta de auditoría del
  // PR #119): pasar el objeto `Exercise` completo revienta la hidratación con
  // `TypeError: exercise.generate is not a function` porque Astro serializa a JSON las props de
  // una isla `client:visible`, y las funciones no sobreviven. Este test lo habría detectado.
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await openTopic(page);
  const exercise = page.getByTestId('exercise').first();
  await exercise.scrollIntoViewIfNeeded();
  // `client:visible` hidrata al entrar en el viewport; Astro quita el atributo `ssr` de la isla
  // una vez React la hidrata, y un `fill` o un click anteriores se pierden en silencio
  // (e2e/exercise.spec.ts, F2-01a ronda 1). Solo se espera la isla de Verifica: el resto de islas
  // del fixture no hacen falta aquí.
  await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid="exercise"]');
    return node?.closest('astro-island')?.hasAttribute('ssr') === false;
  });
  await expect(exercise).toHaveAttribute('data-status', 'pending');

  // El ejercicio anónimo redibuja su instancia en un efecto tras la hidratación (`useSeed`,
  // sesión nula), así que el `fill` se reintenta hasta que el valor se queda escrito.
  const answer = exercise.getByRole('textbox');
  await expect
    .poll(async () => {
      await answer.fill('1');
      return answer.inputValue();
    })
    .toBe('1');

  const verify = exercise.getByRole('button', { name: 'Comprobar' });
  await expect
    .poll(async () => {
      await verify.click();
      return exercise.getAttribute('data-status');
    })
    .not.toBe('pending');

  expect(pageErrors).toEqual([]);
});

test('el aviso de progreso no rompe la hidratación aunque la sesión se lea antes (#231)', async ({
  page,
}) => {
  // `ProgressNotice` depende de `$sessionReady`, que el servidor no conoce. Si la sesión se leía
  // antes de que su isla se hidratara, el primer render del cliente pintaba el aviso sobre un
  // marcado vacío y React lanzaba el error #418. Retener su módulo fuerza ese orden, que en CI
  // solo ocurría a veces y hacía intermitente el test anterior.
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.route(/\/ProgressNotice\./, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, NOTICE_MODULE_DELAY_MS));
    await route.continue();
  });

  await openTopic(page);
  await expect(page.getByTestId('progress-notice')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

// #284: on the real topics of module 0, running text keeps the 72ch reading width while each
// Explora widget takes the whole content column (docs/design/03-tema-oscuro.png). At 1280 px the
// column is 1200 − 2·40 padding − 200 outline − 64 gap = 856 px.
const MODULE_0_TOPICS = ['t01', 't02', 't03'] as const;
const DESKTOP = { width: 1280, height: 800 };
const MIN_WIDGET_WIDTH_PX = 850;
/** A canvas or svg at least this wide is a viewer or a chart, not an icon. */
const MIN_VIEWER_WIDTH_PX = 200;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Opens a module 0 topic and waits for the first Explora widget to paint its viewer. */
async function openExplora(page: Page, topic: string): Promise<Locator> {
  await page.goto(`/ruta/ruta-1/m00/${topic}`);
  const widget = page.locator('#explora [data-topic-widget]').first();
  await expect(widget.getByTestId('readout-panel').first()).toBeVisible();
  await expect(widget.locator('canvas, svg').first()).toBeVisible();
  return widget;
}

/** The value panel and the viewers (canvas or svg wider than an icon) of a widget, in DOM order. */
async function widgetBoxes(widget: Locator): Promise<{ panel: Box; viewers: Box[] }> {
  return widget.evaluate((root, minWidth) => {
    const box = (element: Element): Box => {
      const { left, right, top, bottom } = element.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    const panel = root.querySelector('[data-testid="readout-panel"]');
    if (panel === null) throw new Error('widget without readout panel');
    const viewers = [...root.querySelectorAll('canvas, svg')]
      .filter((element) => !panel.contains(element))
      .map(box)
      .filter(({ left, right }) => right - left >= minWidth);
    return { panel: box(panel), viewers };
  }, MIN_VIEWER_WIDTH_PX);
}

for (const topic of MODULE_0_TOPICS) {
  test(`${topic} a 1280 px: el widget de Explora ocupa la columna, con el visor al lado del panel`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const widget = await openExplora(page, topic);

    const { width } = (await widget.boundingBox())!;
    expect(width).toBeGreaterThanOrEqual(MIN_WIDGET_WIDTH_PX);
    const { panel, viewers } = await widgetBoxes(widget);
    // Starts left of the panel and overlaps it vertically: same row. The right edge is not
    // compared because the growing charts of t03 are #283, fixed in its own PR.
    const beside = viewers.filter(
      (viewer) =>
        viewer.left < panel.left && viewer.top < panel.bottom && viewer.bottom > panel.top,
    );
    expect(beside.length).toBeGreaterThan(0);
  });

  test(`${topic} a 1280 px: los párrafos del texto corrido no pasan de 72ch`, async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openExplora(page, topic);

    // Each paragraph written in the MDX (outside any island) is measured against a 72ch probe in
    // its own font.
    const overflows = await page.locator('article [data-section]').evaluateAll((sections) =>
      sections
        .flatMap((section) => [...section.querySelectorAll('p')])
        .filter((paragraph) => paragraph.closest('astro-island') === null)
        .map((paragraph) => {
          const probe = document.createElement('span');
          probe.style.cssText = 'display:inline-block;width:72ch';
          paragraph.append(probe);
          const limit = probe.getBoundingClientRect().width;
          probe.remove();
          return {
            text: paragraph.textContent?.slice(0, 40),
            excess: paragraph.getBoundingClientRect().width - limit,
          };
        })
        .filter(({ excess }) => excess > 0.5),
    );
    expect(overflows).toEqual([]);
  });

  test(`${topic} a 390 px: el visor queda sobre el panel`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    const widget = await openExplora(page, topic);

    const { panel, viewers } = await widgetBoxes(widget);
    expect(viewers[0]!.bottom).toBeLessThanOrEqual(panel.top);
  });
}

// t03 is left out: its horizontal scroll comes from the growing charts of #283, which
// tema-m00-t03.spec.ts checks with its fix.
for (const topic of ['t01', 't02'] as const) {
  test(`${topic} a 390 px: sin scroll horizontal`, async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await openExplora(page, topic);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

// #302: everything that is not an Explora simulator shares one reading column (72ch): running
// text, formula cards, experiments, the «Mi robot» form and the exercises have the same width and
// the same left edge. Only the Explora widgets take the whole content column (checked above).
const READING_BLOCKS = {
  formula: '[data-block="true"]',
  experiment: '[data-testid="experiment"]',
  myRobot: '[data-testid="my-robot-form"]',
  exercise: '[data-testid="exercise"]',
} as const;
const EDGE_TOLERANCE_PX = 1;

for (const topic of MODULE_0_TOPICS) {
  test(`${topic} a 1280 px: texto, fórmulas, experimentos, Mi robot y ejercicios comparten la columna de lectura`, async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await openExplora(page, topic);
    // Formula cards and «Mi robot» are `client:only` islands that paint after a dynamic import.
    await expect
      .poll(() =>
        page
          .locator('article astro-island[client="only"]')
          .evaluateAll((islands) => islands.every((island) => island.childElementCount > 0)),
      )
      .toBe(true);

    const blocks = await page
      .locator('article:has([data-section])')
      .evaluate((article, selectors) => {
        const box = (kind: string) => (element: Element) => {
          const { left, width } = element.getBoundingClientRect();
          return { kind, left, width };
        };
        const paragraphs = [...article.querySelectorAll('[data-section] p')].filter(
          (paragraph) => paragraph.closest('astro-island, [data-testid="experiment"]') === null,
        );
        return [
          ...paragraphs.map(box('paragraph')),
          ...Object.entries(selectors).flatMap(([kind, selector]) =>
            [...article.querySelectorAll(selector)].map(box(kind)),
          ),
        ];
      }, READING_BLOCKS);

    const kinds = new Set(blocks.map(({ kind }) => kind));
    expect([...kinds].sort()).toEqual(
      [
        'paragraph',
        'formula',
        'experiment',
        'exercise',
        ...(topic === 't01' ? ['myRobot'] : []),
      ].sort(),
    );
    const { left, width } = blocks[0]!;
    const misaligned = blocks.filter(
      (block) =>
        Math.abs(block.left - left) > EDGE_TOLERANCE_PX ||
        Math.abs(block.width - width) > EDGE_TOLERANCE_PX,
    );
    expect(misaligned).toEqual([]);
  });
}
