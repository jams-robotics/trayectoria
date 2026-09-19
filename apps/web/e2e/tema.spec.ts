import { expect, test, type Page } from '@playwright/test';

import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };
import route from '../../../content/es/ruta-1/ruta.json' with { type: 'json' };

// F2-13 acceptance criteria, on the example topic and with no session: the page is static and
// the only island is the exercise, which falls back to its null progress adapter (#97, decisión 7).
const TOPIC_URL = '/ruta/ruta-1/m00/t01';
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

/** Orden plano de los temas de ruta.json: el vecino de m00-t01 es el siguiente de ese orden. */
const ORDERED = route.modules.flatMap((module) => module.topics);
const MOBILE = { width: 390, height: 844 };

async function openTopic(page: Page): Promise<void> {
  await page.goto(TOPIC_URL);
  await expect(page.locator('h1')).toBeVisible();
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

  // m00-t01 es el primer tema de la ruta: no tiene anterior, y su siguiente es m00-t02, que
  // todavía no está publicado y por eso aparece sin enlace.
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
  await expect(reference).toContainText('Young, H. D. y Freedman, R. A.');
  await expect(reference).toContainText('Unidades, cantidades físicas y vectores');
});

test('Verifica monta un ExerciseWidget por ejercicio declarado', async ({ page }) => {
  await openTopic(page);
  const exercises = page.getByTestId('exercise');
  await expect(exercises).toHaveCount(1);
  await expect(exercises.first()).toHaveAttribute('data-status', 'pending');
});
