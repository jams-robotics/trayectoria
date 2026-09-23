import type { SeededRng } from '../random/SeededRng';

/** How close a response has to be to the expected answer to count as correct. */
export interface Tolerance {
  /** `relative` compares the relative error against `value`; `absolute` compares the difference. */
  readonly type: 'relative' | 'absolute';
  /** Strictly positive. A relative tolerance of `0.02` is 2 %. */
  readonly value: number;
}

/** What a generator produces for one seed. */
export interface GeneratedExercise<V> {
  /** Values interpolated into the statement, already in the units the statement announces. */
  readonly values: V;
  /** Expected answer: a scalar, or one number per component for vector answers. */
  readonly answer: number | readonly number[];
  /**
   * Unit of the answer, as shown to the learner. Empty for dimensionless answers. One unit for every
   * component, or a list with one entry per component of the answer (e.g. `['m/s', '°']` for a
   * magnitude and an angle); its length is checked against the answer by `check`.
   */
  readonly unit: string | readonly string[];
}

/** A pure, seed-driven exercise. The UI and progress persistence live outside `sim-core`. */
export interface Exercise<V> {
  readonly id: string;
  /** Draws one instance of the exercise from the generator. Must be pure given the rng. */
  readonly generate: (rng: SeededRng) => GeneratedExercise<V>;
  /** Returns the i18n key of the statement; the UI interpolates the formatted `values`. */
  readonly statement: (values: V) => string;
  /**
   * One tolerance for every component, or a list with one entry per component of the answer
   * (e.g. relative for a magnitude and absolute for an angle).
   */
  readonly tolerance: Tolerance | readonly Tolerance[];
}

/**
 * Validates and freezes an exercise definition.
 *
 * `id` must be a non-empty identifier and every tolerance value must be strictly positive, so that a
 * misconfigured exercise fails at definition time instead of silently accepting every response. A
 * tolerance list must not be empty; its length is checked against the answer by `check`.
 */
export function defineExercise<V>(definition: Exercise<V>): Exercise<V> {
  if (definition.id.trim() === '') {
    throw new RangeError('defineExercise: id must be a non-empty string');
  }

  return Object.freeze({
    id: definition.id,
    generate: definition.generate,
    statement: definition.statement,
    tolerance: freezeTolerance(definition.tolerance),
  });
}

/** Validates a single tolerance or a per-component list and returns a frozen copy. */
function freezeTolerance(
  tolerance: Tolerance | readonly Tolerance[],
): Tolerance | readonly Tolerance[] {
  if (!isToleranceList(tolerance)) {
    return validateTolerance(tolerance, 'tolerance');
  }
  if (tolerance.length === 0) {
    throw new RangeError('defineExercise: tolerance list must have one entry per answer component');
  }
  return Object.freeze(
    tolerance.map((entry, index) => validateTolerance(entry, `tolerance[${index}]`)),
  );
}

function validateTolerance(tolerance: Tolerance, label: string): Tolerance {
  if (!Number.isFinite(tolerance.value) || tolerance.value <= 0) {
    throw new RangeError(
      `defineExercise: ${label}.value must be a finite number > 0, received ${tolerance.value}`,
    );
  }
  return Object.freeze({ ...tolerance });
}

/** Narrows a tolerance declaration to its per-component list form. */
export function isToleranceList(
  tolerance: Tolerance | readonly Tolerance[],
): tolerance is readonly Tolerance[] {
  return Array.isArray(tolerance);
}
