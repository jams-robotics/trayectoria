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
  /**
   * Optional i18n keys, one per component of a vector answer, naming what each field asks for
   * (`content.<topicId>.labels.<exerciseId>.<n>`, #629). Without them the UI numbers the fields.
   * Its length is checked against the answer by `check`.
   */
  readonly labels?: readonly string[];
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
  /**
   * Present on a multiple-choice exercise (`defineChoiceExercise`): the UI shows the options
   * instead of a numeric field, and the answer is the index of the correct one.
   */
  readonly choices?: Choices;
}

/** Options of a multiple-choice exercise, as i18n keys of the content catalogue. */
export interface Choices {
  /** One key per option, 3 or 4, in the order they are shown. */
  readonly options: readonly string[];
  /** Key of the explanation shown once the learner answers, right or wrong. */
  readonly explanation: string;
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

/** Definition of a multiple-choice exercise; texts are i18n keys, like the statement of any exercise. */
export interface ChoiceExerciseDefinition {
  readonly id: string;
  /** i18n key of the statement. */
  readonly statement: string;
  /** i18n keys of the options, 3 or 4. */
  readonly options: readonly string[];
  /** Index in `options` of the only correct one. */
  readonly correct: number;
  /** i18n key of the explanation shown on answering. */
  readonly explanation: string;
}

/**
 * Multiple-choice exercise: the answer is the index of the correct option, graded by `check`
 * like any numeric one (absolute tolerance below one index step), so progress needs no changes.
 */
export function defineChoiceExercise(definition: ChoiceExerciseDefinition): Exercise<Record<string, never>> {
  const { options, correct } = definition;
  if (options.length < 3 || options.length > 4) {
    throw new RangeError(`defineChoiceExercise: "${definition.id}" needs 3 or 4 options, got ${options.length}`);
  }
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    throw new RangeError(`defineChoiceExercise: "${definition.id}" correct index ${correct} is out of range`);
  }
  const base = defineExercise<Record<string, never>>({
    id: definition.id,
    generate: () => ({ values: {}, answer: correct, unit: '' }),
    statement: () => definition.statement,
    tolerance: { type: 'absolute', value: 0.5 },
  });
  return Object.freeze({
    ...base,
    choices: Object.freeze({ options: Object.freeze([...options]), explanation: definition.explanation }),
  });
}
