import { expect, test, type Locator, type Page } from '@playwright/test';

import widgets from '../../../packages/i18n/locales/es/widgets.json' with { type: 'json' };

// F2-10 acceptance criteria, on the `/dev/widgets` playground and with no session: the widget
// falls back to its null progress adapter, so nothing is written and Supabase is not needed
// (#94, decisions 1 and 8).
const EXERCISE = widgets.ExerciseWidget;

// The `Scalar` and `Vector` stories run on fixed seeds (#94, decision 7), so their instances —
// and therefore their answers — are the same on every run.
const SCALAR_ANSWER_S = 7.608258 / 0.392499;

/** Opens the playground and waits for React to hydrate every island before interacting. */
async function openPlayground(page: Page): Promise<void> {
  await page.goto('/dev/widgets');
  // The gallery is a `client:only` island (QA #108, PR #140), so there is no `ssr` attribute to
  // wait out — the DOM is simply empty until React mounts. A click landing before that is
  // silently a no-op (e2e/auth.spec.ts, F2-01a ronda 1), so wait for a story to be visible.
  await expect(page.locator('[data-story]').first()).toBeVisible();
}

function story(page: Page, name: string): Locator {
  return page.locator(`[data-widget="ExerciseWidget"] [data-story="${name}"]`);
}

/** The visible result line, distinct from the same sentence in the `aria-live` region. */
function result(scope: Locator): Locator {
  return scope.getByTestId('exercise-result');
}

/**
 * Types every component of the response and presses «Comprobar».
 *
 * The island hydrates asynchronously after the SSR markup is already in the DOM (F2-01a, ronda
 * 1): a `fill` or a click that lands before React attaches its handlers is silently lost, so
 * both are retried until the value sticks and the result line appears.
 */
async function answer(scope: Locator, ...values: readonly string[]): Promise<void> {
  const fields = scope.getByRole('textbox');
  for (const [index, value] of values.entries()) {
    const field = fields.nth(index);
    await expect
      .poll(async () => {
        await field.fill(value);
        return field.inputValue();
      })
      .toBe(value);
  }
  const verify = scope.getByRole('button', { name: EXERCISE.verify });
  await expect
    .poll(async () => {
      await verify.click();
      return result(scope).count();
    })
    .toBeGreaterThan(0);
}

test('Scalar: the right answer shows the correct state', async ({ page }) => {
  await openPlayground(page);
  const scope = story(page, 'Scalar');

  await expect(scope.getByTestId('exercise')).toHaveAttribute('data-status', 'pending');
  await answer(scope, String(SCALAR_ANSWER_S));

  await expect(result(scope)).toContainText(EXERCISE.correct);
  await expect(scope.getByTestId('exercise')).toHaveAttribute('data-status', 'correct');
});

test('Scalar: an answer 10 % off shows the percentage and the attempt counter', async ({
  page,
}) => {
  await openPlayground(page);
  const scope = story(page, 'Scalar');

  await answer(scope, String(1.1 * SCALAR_ANSWER_S));

  await expect(result(scope)).toContainText('Incorrecto · fuera por 10.0 %');
  await expect(scope.getByTestId('exercise-attempt')).toHaveText('Intento 1');
  await expect(scope.getByTestId('exercise')).toHaveAttribute('data-status', 'incorrect');
});

test('«Nuevos valores» draws a different statement and clears the result', async ({ page }) => {
  await openPlayground(page);
  const scope = story(page, 'Anonymous');
  const statement = scope.getByTestId('exercise-statement');

  await answer(scope, '1');
  await expect(scope.getByTestId('exercise-attempt')).toHaveText('Intento 1');
  // Read after the island is live: the anonymous instance is drawn in an effect after hydration.
  const before = await statement.textContent();

  await scope.getByRole('button', { name: EXERCISE.regenerate }).click();

  await expect(statement).not.toHaveText(before ?? '');
  await expect(scope.getByTestId('exercise')).toHaveAttribute('data-status', 'pending');
  await expect(scope.getByTestId('exercise-attempt')).toBeHidden();
});

test('Anonymous: the widget grades with no session', async ({ page }) => {
  await openPlayground(page);
  const scope = story(page, 'Anonymous');

  // The instance is random and is drawn in an effect right after hydration, so the statement
  // settles one render after the island is live: it is read inside the poll, together with the
  // answer it implies (the track length in metres over the speed in m/s).
  await expect
    .poll(async () => {
      const statement = (await scope.getByTestId('exercise-statement').textContent()) ?? '';
      const match = /pista de ([\d.]+) m a ([\d.]+) m\/s/.exec(statement);
      if (match === null) return statement;
      await answer(scope, String(Number(match[1]) / Number(match[2])));
      return (await result(scope).textContent()) ?? '';
    })
    .toContain(EXERCISE.correct);
});

test('Vector: one field per component, both must be inside the tolerance', async ({ page }) => {
  await openPlayground(page);
  const scope = story(page, 'Vector');

  await expect(scope.getByRole('textbox')).toHaveCount(2);
  await answer(scope, '0.372394', String(1.1 * 0.998503));
  await expect(result(scope)).toContainText('Incorrecto · fuera por 10.0 %');

  await answer(scope, '0.372394', '0.998503');
  await expect(result(scope)).toContainText(EXERCISE.correct);
});
