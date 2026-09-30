import { expect, test, type Page } from '@playwright/test';

import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };
import ruta1 from '../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import ruta2 from '../../../content/es/ruta-2/ruta.json' with { type: 'json' };

// «Ruta completada» (ARCHITECTURE §3.2, #410), one per route since #574. The progress is simulated
// as an anonymous learner: the browser copy of the progress map (key `trayectoria.progress`,
// F3-01) is written before the page loads, which is the same source the route index reads without
// a session. `routesVersion: 2` marks a copy whose ids are already the ones of the two routes
// (ARCHITECTURE §5.4).
const STORAGE_KEY = 'trayectoria.progress';
const ROUTES_VERSION = 2;
const FUNDAMENTOS = ruta1.modules.flatMap((module) =>
  module.topics.map((topic) => `ruta-1/${topic.id}`),
);
const ROBOT_MOVIL = ruta2.modules.flatMap((module) =>
  module.topics.map((topic) => `ruta-2/${topic.id}`),
);

function topic(status: 'in_progress' | 'completed') {
  return {
    status,
    bestScore: status === 'completed' ? 1 : 0,
    attempts: 1,
    completedAt: status === 'completed' ? '2026-01-01T00:00:00.000Z' : null,
    correctIds: [],
    firstTryCorrectIds: [],
  };
}

type Topics = Record<string, ReturnType<typeof topic>>;

const completed = (ids: readonly string[]): Topics =>
  Object.fromEntries(ids.map((id) => [id, topic('completed')]));

/** Seeds the anonymous browser copy; without `routesVersion` it is a copy of the single route. */
async function seedProgress(page: Page, topics: Topics, routesVersion: number | null) {
  const stored =
    routesVersion === null ? { owner: null, topics } : { owner: null, topics, routesVersion };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    STORAGE_KEY,
    JSON.stringify(stored),
  ] as const);
}

/** Opens a route index once every island has hydrated (see e2e/progress.spec.ts). */
async function openRoute(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

test('Fundamentos completed: its index shows «Ruta completada» and the link to Robot móvil', async ({
  page,
}) => {
  expect(FUNDAMENTOS).toHaveLength(14);
  await seedProgress(page, completed(FUNDAMENTOS), ROUTES_VERSION);
  await openRoute(page, '/ruta/ruta-1');

  await expect(page.getByTestId('route-progress-count')).toHaveText('14/14');
  await expect(page.getByTestId('route-completed')).toHaveText(common.route.completed);
  const next = page.getByTestId('route-completed-continue');
  await expect(next).toHaveText(common.route.continue.replace('{{title}}', ruta2.shortTitle));
  await expect(next).toHaveAttribute('href', '/ruta/ruta-2');

  // Each route has its own notice: Robot móvil is still untouched.
  await openRoute(page, '/ruta/ruta-2');
  await expect(page.getByTestId('route-progress-count')).toHaveText('0/11');
  await expect(page.getByTestId('route-completed')).toHaveCount(0);
});

test('Robot móvil completed: its index shows the notice, with no link after it', async ({
  page,
}) => {
  expect(ROBOT_MOVIL).toHaveLength(11);
  await seedProgress(page, completed(ROBOT_MOVIL), ROUTES_VERSION);
  await openRoute(page, '/ruta/ruta-2');

  await expect(page.getByTestId('route-progress-count')).toHaveText('11/11');
  await expect(page.getByTestId('route-completed')).toHaveText(common.route.completed);
  await expect(page.getByTestId('route-completed-continue')).toHaveCount(0);
});

test('one topic in progress: the notice is not shown', async ({ page }) => {
  const [last = '', ...others] = [...FUNDAMENTOS].reverse();
  await seedProgress(page, { ...completed(others), [last]: topic('in_progress') }, ROUTES_VERSION);
  await openRoute(page, '/ruta/ruta-1');

  await expect(page.getByTestId('route-progress-count')).toHaveText('13/14');
  await expect(page.getByTestId('route-completed')).toHaveCount(0);
});

test('one topic never started: the notice is not shown', async ({ page }) => {
  await seedProgress(page, completed(ROBOT_MOVIL.slice(1)), ROUTES_VERSION);
  await openRoute(page, '/ruta/ruta-2');

  await expect(page.getByTestId('route-progress-count')).toHaveText('10/11');
  await expect(page.getByTestId('route-completed')).toHaveCount(0);
});

test('a copy of the single route is converted: its 28 topics complete both routes', async ({
  page,
}) => {
  // The 28 ids before #574 (docs/CURRICULUM.md, «Tabla de equivalencias»), with no routesVersion.
  const oldIds = [
    ...['m00-t01', 'm00-t02', 'm00-t03', 'm01-t01', 'm01-t02', 'm01-t03', 'm01-t04'],
    ...['m02-t01', 'm02-t02', 'm02-t03', 'm03-t01', 'm03-t02', 'm03-t03'],
    ...['m04-t01', 'm04-t02', 'm04-t03', 'm04-t04', 'm04-t05'],
    ...['m05-t01', 'm05-t02', 'm05-t03', 'm05-t04', 'm05-t05'],
    ...['m06-t01', 'm06-t02', 'm06-t03', 'm06-t04', 'm06-t05'],
  ].map((slug) => `ruta-1/${slug}`);
  expect(oldIds).toHaveLength(28);
  await seedProgress(page, completed(oldIds), null);

  await openRoute(page, '/ruta/ruta-1');
  await expect(page.getByTestId('route-progress-count')).toHaveText('14/14');
  await openRoute(page, '/ruta/ruta-2');
  await expect(page.getByTestId('route-progress-count')).toHaveText('11/11');
  await expect(page.getByTestId('route-completed')).toHaveText(common.route.completed);
});
