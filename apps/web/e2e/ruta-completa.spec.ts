import { expect, test, type Locator, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import aula from '../../../packages/i18n/locales/es/aula.json' with { type: 'json' };
import widgets from '../../../packages/i18n/locales/es/widgets.json' with { type: 'json' };
import ruta from '../../../content/es/ruta-1/ruta.json' with { type: 'json' };
import { E2E_PASSWORD, joinGroup, signUp, type TestUser } from './helpers/supabase';
import { openMobileSim, readout } from './sim-movil.helpers';

/**
 * F7-04 acceptance criterion 1: the full route, end to end, against the local Supabase stack.
 *
 * A single registered student walks the 27 topics of `content/es/ruta-1/ruta.json` and answers a
 * scalar `Verifica` exercise of each one, then opens the mobile simulator with «Mi robot», and
 * finally a teacher who shares a group with the student sees their progress in `/aula`.
 *
 * `apps/web` (this package, e2e included) may only import from `sims`, `widgets`, `progress`,
 * `auth`, `db`, `i18n`, `robot-spec` and `content` (docs/ARCHITECTURE.md §2, enforced by
 * `import-x/no-restricted-paths`), so this spec cannot pull `@trayectoria/sim-core` in to
 * regenerate an exercise's expected answer from its seed, and it does not read any topic's
 * `ejercicios.ts` formulas either (QA does not read source before testing). Instead it solves each
 * exercise the way a black box has to: `check()` (`packages/sim-core/src/exercises/check.ts`)
 * reports a relative error `|response − expected| / |expected|` for any response, so two probe
 * responses of a scalar answer give two equations for the one unknown `expected`. Vector exercises
 * report only the worst component's error, which is not solvable this way, so this spec picks, per
 * topic, the first `Verifica` exercise that shows exactly one field.
 */

const MY_ROBOT = widgets.MyRobotWidget;
const TEACHER_NAME = 'Docente ruta completa';
const STUDENT_NAME = 'Estudiante ruta completa';
const GROUP_NAME = 'Ruta completa E2E';

const TOPICS = ruta.modules.flatMap((module) =>
  module.topics.map((topic) => ({ moduleId: module.id, topicId: topic.id, title: topic.title })),
);

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

async function signInOnPage(page: Page, email: string): Promise<void> {
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
}

/** Types `value` into `field`, retrying until the controlled input keeps it (hydration race). */
async function fillSticky(field: Locator, value: string): Promise<void> {
  await expect
    .poll(async () => {
      await field.fill(value);
      return field.inputValue();
    })
    .toBe(value);
}

/**
 * Clicks «Comprobar» and reads back the graded `data-status` of `exercise`. Retried like every
 * other first interaction with a freshly opened topic (e2e/exercise.spec.ts, F2-01a ronda 1): the
 * island can still be hydrating when the click lands, which would otherwise be a silent no-op.
 */
async function checkOnce(exercise: Locator): Promise<string | null> {
  const verify = exercise.getByRole('button', { name: 'Comprobar' });
  // `checking` is a real, non-terminal status while `recordAttempt`'s write settles
  // (ExerciseWidget/state.ts `grade`): waiting for merely "not pending" stopped here instead of
  // at `correct`/`incorrect`, so a slow write read back as an unexpected status.
  await expect
    .poll(async () => {
      await verify.click();
      return exercise.getAttribute('data-status');
    }, { timeout: 15_000 })
    .toMatch(/^(correct|incorrect)$/);
  return exercise.getAttribute('data-status');
}

/** «Incorrecto · fuera por X %» → `X / 100` as a plain fraction. */
async function readRelativeError(exercise: Locator): Promise<number> {
  const text = (await exercise.getByTestId('exercise-result').textContent()) ?? '';
  const match = /([\d.]+)\s*%/.exec(text);
  if (match === null) throw new Error(`no percentage in result line "${text}"`);
  return Number(match[1]) / 100;
}

/**
 * The candidates a single probe and its reported relative error imply. `check()` reports
 * `error = |probe − expected| / |expected|`, so either `probe` is above `expected`
 * (`expected = probe / (1 + error)`) or below it (`expected = probe / (1 − error)`, only valid
 * while `error < 1`). Near `expected = 0` that ratio is unstable (`check.ts` falls back to the
 * absolute error exactly at `expected === 0`, and rounds `errorPercent` to 1 decimal right next to
 * it either way), so the two candidates of the absolute reading — `probe ± error` — are added too;
 * one of the four is always within rounding of the true `expected`.
 */
function candidatesFor(probe: number, error: number): readonly number[] {
  const candidates: number[] = [probe / (1 + error), probe - error, probe + error];
  if (error < 1) candidates.push(probe / (1 - error));
  return candidates;
}

/** Index of the first `Verifica` exercise of the currently open topic with exactly one answer
 * field, or `null` if every exercise is a vector (this spec cannot solve those, see header). */
async function firstScalarExerciseIndex(page: Page): Promise<number | null> {
  const exercises = page.getByTestId('exercise');
  const count = await exercises.count();
  for (let index = 0; index < count; index += 1) {
    if ((await exercises.nth(index).getByRole('textbox').count()) === 1) return index;
  }
  return null;
}

/** Somewhat-generous settle window for `statementIsStable` (see `solveATopicExercise`). */
const STATEMENT_STABLE_MS = 800;

/**
 * Waits for the exercise's statement text to stop changing. Needed for a signed-in student: SSR
 * renders the instance for `userId=null` (the server has no session), and the real, signed-in
 * seed only takes effect once the client's session settles — for a `client:visible` island like
 * `Verifica`'s, that has almost always already happened by the time it hydrates on scroll, so
 * React hydrates the anonymous SSR markup, immediately detects the mismatch against the
 * signed-in instance, and remounts the exercise with different numbers (`ExerciseWidget/state.ts`
 * `useSeed`, which reads `adapter.userId()` with no gate on `$sessionReady`). Probing before this
 * settles solves for an instance that is about to disappear.
 */
async function waitForStableStatement(exercise: Locator): Promise<void> {
  const statement = exercise.getByTestId('exercise-statement');
  await expect(statement).toBeVisible();
  await expect
    .poll(async () => {
      const before = await statement.textContent();
      await new Promise((resolve) => setTimeout(resolve, STATEMENT_STABLE_MS));
      const after = await statement.textContent();
      return before === after ? after : null;
    })
    .not.toBeNull();
}

/** Recognises the known hydration-mismatch defect (see `waitForStableStatement`) so it is
 * reported once, separately, instead of once per topic. */
function isKnownHydrationMismatch(message: string): boolean {
  return message.includes('Hydration failed because the server rendered text');
}

/**
 * Opens one topic and solves a scalar exercise of its `Verifica` section (see header comment).
 * Returns a defect string instead of throwing, so one broken topic does not stop the rest of the
 * route (F7-04 instructions): the caller collects these and fails the test once, at the end.
 */
async function solveATopicExercise(
  page: Page,
  topicId: string,
  hydrationMismatches: string[],
): Promise<string | null> {
  const [moduleId, topicNumber] = topicId.split('-');
  // A topic page mixes `client:load` and `client:visible` islands (Explora's simulators, each
  // Verifica exercise): the `client:visible` ones only hydrate once scrolled into view, so
  // `openHydrated`'s "every astro-island lost its ssr attribute" wait never resolves here
  // (movil-smoke.spec.ts hit the same thing). What this spec needs hydrated is the exercise
  // itself, so it scrolls to it and waits on its own island instead.
  const pageErrors: string[] = [];
  const onPageError = (error: Error): void => void pageErrors.push(error.message);
  page.on('pageerror', onPageError);
  try {
    await page.goto(`/ruta/ruta-1/${moduleId}/${topicNumber}`);
    const index = await firstScalarExerciseIndex(page);
    if (index === null) return `${topicId}: no scalar ExerciseWidget found in Verifica`;
    const exercise = page.getByTestId('exercise').nth(index);
    await exercise.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      (at) =>
        [...document.querySelectorAll('[data-testid="exercise"]')][at]
          ?.closest('astro-island')
          ?.hasAttribute('ssr') === false,
      index,
    );
    // Waits past the hydration-mismatch remount (if it fires) before probing, so the instance is
    // the settled, signed-in one and not the anonymous SSR draft about to be discarded.
    await waitForStableStatement(exercise);

    const unknownErrors = pageErrors.filter((message) => !isKnownHydrationMismatch(message));
    for (const message of pageErrors) {
      if (isKnownHydrationMismatch(message)) hydrationMismatches.push(`${topicId} e${index + 1}`);
    }
    if (unknownErrors.length > 0) {
      return `${topicId}: page error while opening Verifica: ${unknownErrors[0]}`;
    }

    return await solveVisibleExercise(exercise, topicId);
  } finally {
    page.off('pageerror', onPageError);
  }
}

/** Best case of `readRelativeError` after a probe: either it graded correct, or the (probe,
 * error) pair to refine from. */
type ProbeOutcome = { readonly correct: true } | { readonly correct: false; readonly error: number };

/** Fills `value`, presses «Comprobar» and reads back the outcome, or a defect string. */
async function probe(
  exercise: Locator,
  field: Locator,
  value: number,
  topicId: string,
): Promise<ProbeOutcome | string> {
  try {
    await fillSticky(field, String(value));
  } catch {
    return `${topicId}: the answer field would not accept "${value}"`;
  }
  const status = await checkOnce(exercise);
  if (status === 'correct') return { correct: true };
  if (status !== 'incorrect') return `${topicId}: unexpected data-status "${status}" after Comprobar`;
  return { correct: false, error: await readRelativeError(exercise) };
}

/** Refinement rounds of `solveVisibleExercise` before giving up (see its comment): each round at
 * most doubles the probes tried (both candidates of the previous best), so this bounds the search
 * to `2^MAX_REFINE_STEPS` probes in the worst case while converging in 2–3 for a single number. */
const MAX_REFINE_STEPS = 6;

/**
 * Solves one scalar exercise by probing and refining (see the header comment): a probe of
 * `value` gives a relative error, which implies exactly two candidate values for `expected`
 * (`candidatesFor`, from `error = |value − expected| / |expected|`). Whichever candidate is
 * actually right either grades correct outright or, probed in turn, reports a much smaller error
 * (its own candidates converge tightly around it); the wrong one reports something far off (often
 * negative or huge). So each round probes both of the current best candidate's implied values and
 * keeps whichever has the smaller error, starting from a first probe of 1.
 *
 * This replaces an earlier version that fixed two probes (1 and 3.7) and solved the resulting pair
 * of equations algebraically: `errorPercent` is shown rounded to 1 decimal
 * (`ExerciseWidget/state.ts`), and a probe far from `expected` reads an error close to 1 (100 %),
 * where that rounding is large enough in absolute terms that the two fixed probes' equations do
 * not agree to any useful precision even though both readings were correct.
 */
async function solveVisibleExercise(exercise: Locator, topicId: string): Promise<string | null> {
  const field = exercise.getByRole('textbox').first();

  let best: { readonly value: number; readonly error: number } = { value: 1, error: Infinity };
  for (let step = 0; step < MAX_REFINE_STEPS; step += 1) {
    const outcome = await probe(exercise, field, best.value, topicId);
    if (typeof outcome === 'string') return outcome;
    if (outcome.correct) return null;
    best = { value: best.value, error: outcome.error };

    const results: Array<{ readonly value: number; readonly error: number }> = [];
    for (const candidate of candidatesFor(best.value, best.error)) {
      // Each candidate must be probed against the live exercise in turn; there is no batch
      // endpoint to probe them concurrently.
      const candidateOutcome = await probe(exercise, field, candidate, topicId);
      if (typeof candidateOutcome === 'string') return candidateOutcome;
      if (candidateOutcome.correct) return null;
      results.push({ value: candidate, error: candidateOutcome.error });
    }
    const closer = results.reduce((a, b) => (a.error <= b.error ? a : b));
    if (closer.error >= best.error) {
      // Neither candidate improved on the current best: as close as this method converges.
      break;
    }
    best = closer;
  }
  const final = await probe(exercise, field, best.value, topicId);
  if (typeof final === 'string') return final;
  if (final.correct) return null;
  return `${topicId}: did not converge to a correct answer in ${MAX_REFINE_STEPS} rounds (closest ${best.value}, error ${(best.error * 100).toFixed(1)} %)`;
}

test.describe('F7-04 · ruta completa', () => {
  test('registro, 27 temas con un ejercicio cada uno, simulador móvil con «Mi robot» y progreso docente', async ({
    page,
    browser,
  }) => {
    test.setTimeout(20 * 60 * 1000);
    expect(TOPICS).toHaveLength(27);

    // 1. Registro de un estudiante nuevo.
    const studentEmail = uniqueEmail('ruta-completa-estudiante');
    const student = await signUp('student', STUDENT_NAME, studentEmail);
    await signInOnPage(page, studentEmail);

    // 2. Los 27 temas, un ejercicio cada uno. Un tema roto se anota y no detiene la ruta. Los
    // hydration mismatches conocidos (ver `waitForStableStatement`) se cuentan aparte: son un
    // defecto único que se repite por tema, no 27 defectos distintos.
    const defects: string[] = [];
    const hydrationMismatches: string[] = [];
    for (const { topicId, title } of TOPICS) {
      const defect = await solveATopicExercise(page, topicId, hydrationMismatches);
      if (defect !== null) defects.push(defect);
      console.log(`[ruta-completa] ${topicId} (${title}): ${defect ?? 'ok'}`);
    }
    if (hydrationMismatches.length > 0) {
      console.log(
        `[ruta-completa] hydration mismatch on Verifica (signed-in): ${hydrationMismatches.join(', ')}`,
      );
    }

    // 3. Simulador móvil con «Mi robot»: guarda un radio de rueda propio en /cuenta y lo ve
    // reflejado en /simuladores/movil, como my-robot-fuera-de-cuenta.spec.ts.
    await openHydrated(page, '/cuenta');
    const form = page.getByTestId('my-robot-form');
    const wheelRadiusInput = form.locator('[data-field="wheelRadius_m"]').getByRole('textbox');
    await fillSticky(wheelRadiusInput, '0.05');
    const save = form.getByRole('button', { name: MY_ROBOT.save });
    await expect
      .poll(async () => {
        await save.click();
        return form.locator('[data-testid="toast"]').count();
      })
      .toBeGreaterThan(0);

    await openMobileSim(page);
    await expect(page.getByTestId('robot-source-select')).toHaveValue('my-robot');
    await page.getByRole('combobox', { name: 'Velocidad de reproducción' }).selectOption('4');
    await page.getByRole('button', { name: 'Reproducir' }).first().click();
    await expect
      .poll(async () => Number.parseFloat((await readout(page)).t), { timeout: 20_000 })
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Pausa' }).first().click();

    // 4. Un docente ve el progreso del estudiante en su aula: crea un grupo y el estudiante se une
    // (helpers/supabase.ts), como aula-progreso.spec.ts.
    const teacherContext = await browser.newContext();
    const teacherPage = await teacherContext.newPage();
    const teacherEmail = uniqueEmail('ruta-completa-docente');
    const teacher: TestUser = await signUp('teacher', TEACHER_NAME, teacherEmail);
    await signInOnPage(teacherPage, teacherEmail);

    await openHydrated(teacherPage, '/aula');
    await teacherPage.getByRole('button', { name: aula.groups.new }).click();
    await teacherPage.getByLabel(aula.create.name, { exact: true }).fill(GROUP_NAME);
    await teacherPage.getByRole('button', { name: aula.create.submit, exact: true }).click();
    await expect(teacherPage.getByTestId('group-title')).toHaveText(GROUP_NAME);
    const code = ((await teacherPage.getByTestId('invite-code').textContent()) ?? '').trim();
    await joinGroup(student.client, code);

    await openHydrated(teacherPage, teacherPage.url().slice(teacherPage.url().indexOf('/aula')));
    await expect(teacherPage.getByTestId('progress-table')).toBeVisible();
    await expect(teacherPage.getByTestId('progress-column').first()).toHaveText(STUDENT_NAME);
    // A topic only turns `completed` (and only then counts in `progress-summary`'s "N/27") once
    // every one of its required exercises is answered correctly (packages/progress/src/model.ts
    // `isCompleted`), and this spec answers just one exercise per topic — so "N/27" can stay
    // "0/27" even though every topic was genuinely attempted. What the teacher's aula must show
    // instead is at least one cell no longer `pending` (`data-state`, ProgressGrid.tsx), unless
    // every topic in fact failed to grade above.
    if (defects.length < TOPICS.length) {
      const attempted = teacherPage.locator(
        '[data-testid="progress-cell"]:not([data-state="pending"])',
      );
      await expect(attempted.first()).toBeVisible();
      expect(await attempted.count()).toBeGreaterThan(0);
    }
    await teacher.client.auth.signOut();
    await teacherContext.close();

    // Report every topic that could not be solved, so a single failing topic still shows all 27
    // outcomes above (console log) instead of stopping at the first one.
    expect(defects, defects.join('\n')).toEqual([]);
  });
});
