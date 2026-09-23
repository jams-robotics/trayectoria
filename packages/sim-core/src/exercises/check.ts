import { createRng } from '../random/SeededRng';
import { isToleranceList, type Exercise, type Tolerance } from './defineExercise';

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
  /** The generated unit: one for every component, or one per component. */
  readonly unit: string | readonly string[];
  /** i18n key of the statement for this instance. */
  readonly statementKey: string;
}

/**
 * Regenerates an exercise from its seed and grades `response` against the expected answer.
 *
 * Pure: the same exercise, seed and response always give the same result, because the generator
 * only sees a fresh `createRng(seed)`. With a tolerance list, each component is graded against its
 * own entry; a tolerance or unit list whose length differs from the answer is a definition error
 * and throws.
 */
export function check<V>(
  exercise: Exercise<V>,
  seed: number,
  response: number | readonly number[],
): CheckResult<V> {
  const { values, answer, unit } = exercise.generate(createRng(seed));
  const expectedComponents = toComponents(answer);
  const responseComponents = toComponents(response);
  const tolerances = tolerancePerComponent(exercise, expectedComponents.length);
  assertUnitPerComponent(exercise.id, unit, expectedComponents.length);

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

    const tolerance = tolerances[index];
    const passes =
      tolerance !== undefined &&
      (tolerance.type === 'relative' ? relError <= tolerance.value : absError <= tolerance.value);
    correct = correct && passes;
  }

  return { ...base, correct, relError: worstRelError };
}

/** A per-component list (tolerances, units, ...) must have one entry per answer component. */
function assertComponentCount(
  exerciseId: string,
  actualLength: number,
  componentCount: number,
  label: string,
): void {
  if (actualLength !== componentCount) {
    throw new RangeError(
      `check: exercise "${exerciseId}" declares ${actualLength} ${label} but its answer has ${componentCount} components`,
    );
  }
}

/** Expands the exercise tolerance into one entry per answer component. */
function tolerancePerComponent<V>(
  exercise: Exercise<V>,
  componentCount: number,
): readonly Tolerance[] {
  const { tolerance } = exercise;
  if (!isToleranceList(tolerance)) {
    return Array.from({ length: componentCount }, () => tolerance);
  }
  assertComponentCount(exercise.id, tolerance.length, componentCount, 'tolerances');
  return tolerance;
}

/** A unit list must have one entry per answer component, like a tolerance list. */
function assertUnitPerComponent(
  exerciseId: string,
  unit: string | readonly string[],
  componentCount: number,
): void {
  if (typeof unit !== 'string') {
    assertComponentCount(exerciseId, unit.length, componentCount, 'units');
  }
}

/** Normalises a scalar or vector answer into a list of components. */
function toComponents(value: number | readonly number[]): readonly number[] {
  return typeof value === 'number' ? [value] : value;
}
