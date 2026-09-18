import { createRng } from '../random/SeededRng';
import type { Exercise } from './defineExercise';

/** Outcome of grading one response against a seeded instance of an exercise. */
export interface CheckResult<V> {
  readonly correct: boolean;
  /** The regenerated expected answer, so the UI can show it after grading. */
  readonly expected: number | readonly number[];
  /**
   * Relative error of the response: `|response - expected| / |expected|`, the worst component for
   * vector answers. Falls back to the absolute error when the expected value is zero, and is
   * `Infinity` when the response has the wrong shape.
   */
  readonly relError: number;
  /** The values the seed generated, for interpolating the statement. */
  readonly values: V;
  readonly unit: string;
  /** i18n key of the statement for this instance. */
  readonly statementKey: string;
}

/**
 * Regenerates an exercise from its seed and grades `response` against the expected answer.
 *
 * Pure: the same exercise, seed and response always give the same result, because the generator
 * only sees a fresh `createRng(seed)`.
 */
export function check<V>(
  exercise: Exercise<V>,
  seed: number,
  response: number | readonly number[],
): CheckResult<V> {
  const { values, answer, unit } = exercise.generate(createRng(seed));
  const expectedComponents = toComponents(answer);
  const responseComponents = toComponents(response);

  const shapeMatches =
    Array.isArray(answer) === Array.isArray(response) &&
    expectedComponents.length === responseComponents.length;

  const base = { expected: answer, values, unit, statementKey: exercise.statement(values) };

  if (!shapeMatches) {
    return { ...base, correct: false, relError: Number.POSITIVE_INFINITY };
  }

  let worstRelError = 0;
  let correct = true;

  for (const [index, expected] of expectedComponents.entries()) {
    const actual = responseComponents[index] ?? Number.NaN;
    if (!Number.isFinite(actual)) {
      return { ...base, correct: false, relError: Number.POSITIVE_INFINITY };
    }

    const absError = Math.abs(actual - expected);
    // With an expected value of zero the relative error is undefined, so report the absolute one.
    const relError = expected === 0 ? absError : absError / Math.abs(expected);
    worstRelError = Math.max(worstRelError, relError);

    const passes =
      exercise.tolerance.type === 'relative'
        ? relError <= exercise.tolerance.value
        : absError <= exercise.tolerance.value;
    correct = correct && passes;
  }

  return { ...base, correct, relError: worstRelError };
}

/** Normalises a scalar or vector answer into a list of components. */
function toComponents(value: number | readonly number[]): readonly number[] {
  return typeof value === 'number' ? [value] : value;
}
