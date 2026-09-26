import { expect, test, type Page } from '@playwright/test';

import common from '../../../packages/i18n/locales/es/common.json' with { type: 'json' };
import ruta from '../../../content/es/ruta-1/ruta.json' with { type: 'json' };

// «Ruta completada» (ARCHITECTURE §3.2, #410). The progress is simulated as an anonymous learner:
// the browser copy of the progress map (key `trayectoria.progress`, F3-01) is written before the
// page loads, which is the same source the route index reads without a session.
const ROUTE_PATH = '/ruta/ruta-1';
const STORAGE_KEY = 'trayectoria.progress';
const TOPIC_IDS = ruta.modules.flatMap((module) =>
  module.topics.map((topic) => `ruta-1/${topic.id}`),
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

/** Seeds the anonymous browser copy with the given topics completed and the rest untouched. */
async function seedProgress(page: Page, topics: Record<string, ReturnType<typeof topic>>) {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    STORAGE_KEY,
    JSON.stringify({ owner: null, topics }),
  ] as const);
}

/** Opens the route index once every island has hydrated (see e2e/progress.spec.ts). */
async function openRoute(page: Page): Promise<void> {
  await page.goto(ROUTE_PATH);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

test('every topic completed: the route index shows «Ruta completada»', async ({ page }) => {
  expect(TOPIC_IDS).toHaveLength(27);
  await seedProgress(page, Object.fromEntries(TOPIC_IDS.map((id) => [id, topic('completed')])));
  await openRoute(page);

  await expect(page.getByTestId('route-progress-count')).toHaveText('27/27');
  await expect(page.getByTestId('route-completed')).toHaveText(common.route.completed);
});

test('one topic in progress: the notice is not shown', async ({ page }) => {
  const [last = '', ...others] = [...TOPIC_IDS].reverse();
  await seedProgress(page, {
    ...Object.fromEntries(others.map((id) => [id, topic('completed')])),
    [last]: topic('in_progress'),
  });
  await openRoute(page);

  await expect(page.getByTestId('route-progress-count')).toHaveText('26/27');
  await expect(page.getByTestId('route-completed')).toHaveCount(0);
});

test('one topic never started: the notice is not shown', async ({ page }) => {
  await seedProgress(
    page,
    Object.fromEntries(TOPIC_IDS.slice(1).map((id) => [id, topic('completed')])),
  );
  await openRoute(page);

  await expect(page.getByTestId('route-progress-count')).toHaveText('26/27');
  await expect(page.getByTestId('route-completed')).toHaveCount(0);
});
