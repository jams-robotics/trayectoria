import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-6.1 (docs/CURRICULUM.md § T-6.1). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// The readings of e1, e2 and e4 come from a line centred at index c: each sensor reads
// v_k = exp(−(k − c)² / (2·0.6²)) rounded to a tenth, and c is drawn again while the five
// readings add up to less than 0.5 (#396). c is drawn on a grid of hundredths.

const TOPIC_ID = 'ruta-1/m06-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** e1: absolute tolerance of 0.01 on p (docs/CURRICULUM.md § T-6.1). */
const ABSOLUTE_P = { type: 'absolute', value: 0.01 } as const;
/** e3: absolute tolerance of 0.0002 m on y_línea (docs/CURRICULUM.md § T-6.1). */
const ABSOLUTE_0_2_MM = { type: 'absolute', value: 0.0002 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

/** Reference array of the statements: N = 5 sensors e_s = 0.012 m apart (#396). */
const SENSOR_COUNT = 5;
const SENSOR_SPACING_M = 0.012;
/** Width of the gaussian bump of the generator, in sensor indices. */
const READING_SIGMA = 0.6;
/** Sum of readings under which the generator draws again (#396). */
export const MIN_READING_SUM = 0.5;
/** Draws of c before giving up; the ranges of the spec never get close to it. */
const MAX_DRAWS = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec. */
export const E1_C: Range = { min: 0.5, max: 3.5 };
export const E2_C: Range = { min: 0, max: 1.2 };
export const E3_P: Range = { min: -1, max: 1 };
export const E4_THRESHOLDS: readonly number[] = [0.3, 0.5, 0.7];

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** The five readings of a line centred at index `c`, each rounded to a tenth. */
export function readingsAt(c: number): number[] {
  return Array.from({ length: SENSOR_COUNT }, (_, k) => {
    const value = Math.exp(-((k - c) ** 2) / (2 * READING_SIGMA ** 2));
    return Math.round(value * TENTHS) / TENTHS;
  });
}

/** Readings from a line centre drawn in `range`, drawn again while their sum is under 0.5. */
function drawReadings(rng: SeededRng, range: Range): number[] {
  for (let draw = 0; draw < MAX_DRAWS; draw += 1) {
    const readings = readingsAt(drawOnGrid(rng, range, HUNDREDTHS));
    if (sum(readings) >= MIN_READING_SUM) return readings;
  }
  throw new Error(`T-6.1: no line centre in [${range.min}, ${range.max}] is seen by the array`);
}

/** p = (k̄ − (N − 1)/2) / ((N − 1)/2), with k̄ = Σ k·v_k / Σ v_k. */
export function linePosition(readings: readonly number[]): number {
  const weightedIndex = sum(readings.map((value, k) => k * value)) / sum(readings);
  const half = (readings.length - 1) / 2;
  return (weightedIndex - half) / half;
}

/** y_línea = p · (N − 1)/2 · e_s, in metres, for the reference array. */
export function lineOffset_m(p: number): number {
  return p * ((SENSOR_COUNT - 1) / 2) * SENSOR_SPACING_M;
}

/** How many sensors read 1 in binary: b_k = 1 ⇔ v_k ≥ u. */
export function sensorsOn(readings: readonly number[], threshold: number): number {
  return readings.filter((value) => value >= threshold).length;
}

interface Readings {
  readonly v0: number;
  readonly v1: number;
  readonly v2: number;
  readonly v3: number;
  readonly v4: number;
}

function readingValues(readings: readonly number[]): Readings {
  const [v0 = 0, v1 = 0, v2 = 0, v3 = 0, v4 = 0] = readings;
  return { v0, v1, v2, v3, v4 };
}

/** e1: p from the five readings, the line anywhere under the array. */
const e1 = defineExercise<Readings>({
  id: 'e1',
  generate: (rng) => {
    const readings = drawReadings(rng, E1_C);
    return { values: readingValues(readings), answer: linePosition(readings), unit: '' };
  },
  statement: () => statementKey('e1'),
  tolerance: ABSOLUTE_P,
});

/** e2: p with the line to the left of the array. */
const e2 = defineExercise<Readings>({
  id: 'e2',
  generate: (rng) => {
    const readings = drawReadings(rng, E2_C);
    return { values: readingValues(readings), answer: linePosition(readings), unit: '' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Position {
  readonly p: number;
}

/** e3: physical offset of the line from p, with N = 5 and e_s = 12 mm fixed. */
const e3 = defineExercise<Position>({
  id: 'e3',
  generate: (rng) => {
    const p = drawOnGrid(rng, E3_P, HUNDREDTHS);
    return { values: { p }, answer: lineOffset_m(p), unit: 'm' };
  },
  statement: () => statementKey('e3'),
  tolerance: ABSOLUTE_0_2_MM,
});

interface Thresholded extends Readings {
  readonly u: number;
}

/** e4 (optional): sensors in 1 for a threshold u over the readings of e1. */
const e4 = defineExercise<Thresholded>({
  id: 'e4',
  generate: (rng) => {
    const readings = drawReadings(rng, E1_C);
    const u = E4_THRESHOLDS[rng.nextInt(0, E4_THRESHOLDS.length - 1)];
    if (u === undefined) throw new Error('T-6.1 e4: threshold index out of range');
    return { values: { ...readingValues(readings), u }, answer: sensorsOn(readings, u), unit: '' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-6.1, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
