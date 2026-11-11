import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { hintFor } from './hints';
import { unitAt } from './state';
import type { ExerciseState } from './state';

/** The attempt from which a wrong answer gets a calculated hint instead of the generic one. */
const HINT_FROM_ATTEMPT = 2;
/** The attempt from which a wrong answer is followed by the solution. */
const SOLUTION_FROM_ATTEMPT = 3;

/**
 * Line shown under a wrong answer: the generic one on the first attempt, then what the response
 * looks like next to the expected value (sign, unit factor, order of magnitude; v1.5).
 */
export function hintText(state: ExerciseState, t: Translate): string {
  const graded = state.graded;
  if (state.attempt < HINT_FROM_ATTEMPT || graded === null) return t('widgets.ExerciseWidget.hint');
  const expected = typeof graded.expected === 'number' ? [graded.expected] : graded.expected;
  const failing = state.componentCorrect?.findIndex((ok) => !ok) ?? -1;
  const at = failing < 0 ? 0 : failing;
  const hint = hintFor(expected[at] ?? 0, graded.response[at] ?? Number.NaN);
  return t(`widgets.ExerciseWidget.${hint.key}`, { factor: hint.factor ?? '' });
}

/** The solution with its unit, from the third wrong attempt on; `null` before that (v1.5). */
export function solutionText(state: ExerciseState, t: Translate): string | null {
  const graded = state.graded;
  if (state.attempt < SOLUTION_FROM_ATTEMPT || graded === null) return null;
  const expected = typeof graded.expected === 'number' ? [graded.expected] : graded.expected;
  const parts = expected.map((value, index) => {
    const text = format(value, unitAt(state.unit, index));
    const label = state.labels?.[index];
    return label === undefined ? text : `${t(label)} = ${text}`;
  });
  return t('widgets.ExerciseWidget.solution', { value: parts.join('; ') });
}
