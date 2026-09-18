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
  /** Unit of the answer, as shown to the learner. Empty for dimensionless answers. */
  readonly unit: string;
}

/** A pure, seed-driven exercise. The UI and progress persistence live outside `sim-core`. */
export interface Exercise<V> {
  readonly id: string;
  /** Draws one instance of the exercise from the generator. Must be pure given the rng. */
  readonly generate: (rng: SeededRng) => GeneratedExercise<V>;
  /** Returns the i18n key of the statement; the UI interpolates the formatted `values`. */
  readonly statement: (values: V) => string;
  readonly tolerance: Tolerance;
}

/**
 * Validates and freezes an exercise definition.
 *
 * `id` must be a non-empty identifier and `tolerance.value` must be strictly positive, so that a
 * misconfigured exercise fails at definition time instead of silently accepting every response.
 */
export function defineExercise<V>(definition: Exercise<V>): Exercise<V> {
  if (definition.id.trim() === '') {
    throw new RangeError('defineExercise: id must be a non-empty string');
  }
  if (!Number.isFinite(definition.tolerance.value) || definition.tolerance.value <= 0) {
    throw new RangeError(
      `defineExercise: tolerance.value must be a finite number > 0, received ${definition.tolerance.value}`,
    );
  }

  return Object.freeze({
    id: definition.id,
    generate: definition.generate,
    statement: definition.statement,
    tolerance: Object.freeze({ ...definition.tolerance }),
  });
}
