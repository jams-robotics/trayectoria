import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import progress from '../../../packages/i18n/locales/es/progress.json' with { type: 'json' };

// F3-01 acceptance criteria. The anonymous test needs no Supabase; the signed-in one runs
// against the local stack, where email confirmations are disabled (supabase/config.toml), so
// sign-up returns a session directly (same setup as e2e/auth.spec.ts).
const TOPIC_PATH = '/ruta/ruta-1/m00/t01';
const ROUTE_PATH = '/ruta/ruta-1';
const TOPIC_ID = 'ruta-1/m00-t01';
const TOTAL_TOPICS = 27;
const PASSWORD = 'trayectoria-e2e-2026';
const DISPLAY_NAME = 'Estudiante E2E';

function uniqueEmail(): string {
  return `progress+${Date.now()}-${test.info().workerIndex}@example.com`;
}

/**
 * Astro removes the `ssr` attribute of an island once React has hydrated it; acting before that
 * would be undone by hydration, and asserting before it would read the server markup.
 *
 * `visible` selects which islands to await. On most pages every island is awaited, like in
 * `e2e/auth.spec.ts`. On a topic page the exercises are `client:visible` and stay on the server
 * markup until they are scrolled into view, so there only the eager ones are awaited and
 * `answerCorrectly` waits for the exercise after scrolling to it.
 */
async function waitForIslands(page: Page, includeVisible = true): Promise<void> {
  await page.waitForFunction(
    (all: boolean) =>
      [...document.querySelectorAll('astro-island')]
        .filter((island) => all || island.getAttribute('client') === 'load')
        .every((island) => !island.hasAttribute('ssr')),
    includeVisible,
  );
}

async function openHydrated(page: Page, pathname: string, includeVisible = true): Promise<void> {
  await page.goto(pathname);
  await waitForIslands(page, includeVisible);
}

/**
 * Reads the statement of the exercise and answers it right: a track of D m at v m/s.
 *
 * The exercise is a `client:visible` island, and an anonymous learner gets a seed drawn right
 * after hydration (#94, decision 2), so both the statement and the response have to be read and
 * typed *after* that island has hydrated: typing before would be undone, and the statement read
 * before would belong to the seed of the server pass.
 */
async function answerCorrectly(page: Page): Promise<void> {
  const exercise = page.getByTestId('exercise');
  await exercise.scrollIntoViewIfNeeded();
  await expect(exercise).toBeVisible();
  await waitForIslands(page);
  const statement = (await page.getByTestId('exercise-statement').textContent()) ?? '';
  // «Tu robot recorre una pista de D m a v m/s…»: the two numbers of the statement, in order.
  const numbers = [...statement.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    Number(match[0].replace(',', '.')),
  );
  const [distance_m, speed_mps] = numbers;
  expect(distance_m).toBeDefined();
  expect(speed_mps).toBeDefined();
  const time_s = (distance_m ?? 0) / (speed_mps ?? 1);
  await exercise.getByRole('textbox', { name: /respuesta/i }).fill(time_s.toFixed(4));
  await exercise.getByRole('button', { name: 'Comprobar' }).click();
  await expect(exercise).toHaveAttribute('data-status', 'correct');
}

/** The status cell of one topic in the route index, once the island has hydrated. */
function topicStatus(page: Page) {
  return page.locator(`[data-testid="topic-status"][data-topic="${TOPIC_ID}"]`);
}

async function signUp(page: Page, email: string): Promise<void> {
  await openHydrated(page, '/auth/registro');
  await page.getByLabel(auth.fields.displayName, { exact: true }).fill(DISPLAY_NAME);
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(auth.roles.student, { exact: true }).check();
  await page.getByRole('button', { name: auth.register.submit }).click();
  await page.waitForURL('**/cuenta');
}

test('anonymous: answering the exercise completes the topic and survives a reload', async ({
  page,
}) => {
  await openHydrated(page, TOPIC_PATH, false);

  // The account notice is the visible difference of the anonymous session.
  await expect(page.getByTestId('progress-notice')).toBeVisible();
  await expect(page.getByTestId('progress-notice')).toContainText(progress.notice.anonymous);
  await expect(page.getByRole('link', { name: progress.notice.register })).toHaveAttribute(
    'href',
    '/auth/registro',
  );

  await answerCorrectly(page);

  await openHydrated(page, ROUTE_PATH);
  await expect(topicStatus(page)).toHaveAttribute('data-state', 'completed');
  await expect(topicStatus(page)).toContainText(progress.status.completed);
  await expect(page.getByTestId('route-progress-count')).toHaveText(`1/${TOTAL_TOPICS}`);

  await page.reload();
  await waitForIslands(page);
  await expect(topicStatus(page)).toHaveAttribute('data-state', 'completed');
  await expect(page.getByTestId('route-progress-count')).toHaveText(`1/${TOTAL_TOPICS}`);
});

test('signed in: the topic completes, signing out hides it and signing in recovers it', async ({
  page,
}) => {
  const email = uniqueEmail();
  await signUp(page, email);

  await openHydrated(page, TOPIC_PATH, false);
  // With a session the notice is gone: the progress is stored for the account.
  await expect(page.getByTestId('progress-notice')).toHaveCount(0);
  await answerCorrectly(page);

  await openHydrated(page, ROUTE_PATH);
  await expect(topicStatus(page)).toHaveAttribute('data-state', 'completed');
  await expect(page.getByTestId('route-progress-count')).toHaveText(`1/${TOTAL_TOPICS}`);

  await openHydrated(page, '/cuenta');
  await page.getByRole('button', { name: auth.account.signOut }).click();
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');

  await openHydrated(page, ROUTE_PATH);
  await expect(topicStatus(page)).toHaveAttribute('data-state', 'pending');
  await expect(page.getByTestId('route-progress-count')).toHaveText(`0/${TOTAL_TOPICS}`);

  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');

  await openHydrated(page, ROUTE_PATH);
  await expect(topicStatus(page)).toHaveAttribute('data-state', 'completed');
  await expect(page.getByTestId('route-progress-count')).toHaveText(`1/${TOTAL_TOPICS}`);
});
