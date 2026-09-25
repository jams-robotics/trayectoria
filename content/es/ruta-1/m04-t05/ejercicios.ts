import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-4.5 (docs/CURRICULUM.md § T-4.5). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (radii to the thousandth, distances to
// the hundredth, tick counts as integers), as in T-0.3 (#273).

const TOPIC_ID = 'ruta-1/m04-t05';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const THOUSANDTHS = 1000;
const HUNDREDTHS = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Encoder and wheel of the reference robot, fixed in e2 to e4 (#301). */
export const FIXED_TICKS_PER_REV = 360;
export const FIXED_WHEEL_RADIUS_M = 0.032;

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_TICKS_PER_REV: readonly number[] = [12, 20, 48, 100, 360, 1024, 2048];
export const E1_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
export const E2_DELTA_TICKS: Range = { min: 5, max: 500 };
export const E2_DT_S: readonly number[] = [0.01, 0.02, 0.05, 0.1];
/** e2 draws again while the robot would go faster than this (#274, #301). */
export const E2_MAX_V_MPS = 1.5;
export const E3_DISTANCE_M: Range = { min: 0.5, max: 5 };
export const E4_TICKS: Range = { min: 100, max: 20000 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

/** One of the values of the set. */
function drawFrom(rng: SeededRng, set: readonly number[]): number {
  const value = set[rng.nextInt(0, set.length - 1)];
  if (value === undefined) throw new Error('drawFrom: empty set');
  return value;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** `res = 2πr / N_e`: the distance the wheel rolls per tick. */
function resolution_m(wheelRadius_m: number, encoderTicksPerRev: number): number {
  return (2 * Math.PI * wheelRadius_m) / encoderTicksPerRev;
}

interface Encoder {
  readonly encoderTicksPerRev: number;
  readonly wheelRadius_m: number;
}

/** e1: linear resolution, res = 2πr / N_e. */
const e1 = defineExercise<Encoder>({
  id: 'e1',
  generate: (rng) => {
    const encoderTicksPerRev = drawFrom(rng, E1_TICKS_PER_REV);
    const wheelRadius_m = drawOnGrid(rng, E1_WHEEL_RADIUS_M, THOUSANDTHS);
    return {
      values: { encoderTicksPerRev, wheelRadius_m },
      answer: resolution_m(wheelRadius_m, encoderTicksPerRev),
      unit: 'm',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface TickSample {
  readonly deltaTicks: number;
  readonly dt_s: number;
}

/** ω ≈ 2π·Δticks / (N_e·Δt) of the fixed encoder. */
function omegaFromTicks_radps(deltaTicks: number, dt_s: number): number {
  return (2 * Math.PI * deltaTicks) / (FIXED_TICKS_PER_REV * dt_s);
}

/** e2: ω ≈ 2π·Δticks / (N_e·Δt) and v = ω·r; drawn again while v > 1.5 m/s. */
const e2 = defineExercise<TickSample>({
  id: 'e2',
  generate: (rng) => {
    for (;;) {
      const deltaTicks = drawOnGrid(rng, E2_DELTA_TICKS, 1);
      const dt_s = drawFrom(rng, E2_DT_S);
      const omega_radps = omegaFromTicks_radps(deltaTicks, dt_s);
      const v_mps = omega_radps * FIXED_WHEEL_RADIUS_M;
      if (v_mps <= E2_MAX_V_MPS) {
        return {
          values: { deltaTicks, dt_s },
          answer: [omega_radps, v_mps],
          unit: ['rad/s', 'm/s'],
        };
      }
    }
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Distance {
  readonly distance_m: number;
}

/** e3: ticks = D·N_e / (2πr), the inverse of s = 2πr·ticks / N_e. */
const e3 = defineExercise<Distance>({
  id: 'e3',
  generate: (rng) => {
    const distance_m = drawOnGrid(rng, E3_DISTANCE_M, HUNDREDTHS);
    return {
      values: { distance_m },
      answer: distance_m / resolution_m(FIXED_WHEEL_RADIUS_M, FIXED_TICKS_PER_REV),
      unit: 'ticks',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface TickCount {
  readonly ticks: number;
}

/** e4 (optional): s = 2πr·ticks / N_e. */
const e4 = defineExercise<TickCount>({
  id: 'e4',
  generate: (rng) => {
    const ticks = drawOnGrid(rng, E4_TICKS, 1);
    return {
      values: { ticks },
      answer: ticks * resolution_m(FIXED_WHEEL_RADIUS_M, FIXED_TICKS_PER_REV),
      unit: 'm',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-4.5, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
