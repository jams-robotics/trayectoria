import {
  defineExercise,
  degToRad,
  freeFallTime,
  maxHeight_m,
  range_m,
  timeOfFlight_s,
} from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-1.4 (docs/CURRICULUM.md § T-1.4). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (v₀ to the tenth, α to the whole degree,
// h to the hundredth), as in T-0.3 (#273). Angles are asked in degrees, as the spec writes them.
// e2 to e4 draw v₀ and α with the ranges of e1 and add h (#287, gap 8).

const TOPIC_ID = 'ruta-1/m01-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** Short times are graded with an absolute 0.01 s (docs/CONTENT-STANDARDS.md §5). */
const ABSOLUTE_10_MS = { type: 'absolute', value: 0.01 } as const;

const TENTHS = 10;
const HUNDREDTHS = 100;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const V0_MPS: Range = { min: 1, max: 8 };
export const LAUNCH_ANGLE_DEG: Range = { min: 15, max: 75 };
export const H_M: Range = { min: 0, max: 1 };
/** e5 is fixed: a robot at 0.6 m/s drops a piece from 0.25 m. */
export const E5_V_MPS = 0.6;
export const E5_H_M = 0.25;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface GroundLaunch {
  readonly v0_mps: number;
  readonly launchAngle_deg: number;
}

interface RaisedLaunch extends GroundLaunch {
  readonly h_m: number;
}

function drawGroundLaunch(rng: SeededRng): GroundLaunch {
  return {
    v0_mps: drawOnGrid(rng, V0_MPS, TENTHS),
    launchAngle_deg: rng.nextInt(LAUNCH_ANGLE_DEG.min, LAUNCH_ANGLE_DEG.max),
  };
}

function drawRaisedLaunch(rng: SeededRng): RaisedLaunch {
  const launch = drawGroundLaunch(rng);
  return { ...launch, h_m: drawOnGrid(rng, H_M, HUNDREDTHS) };
}

/** e1: `R = v₀² sin 2α / g`, which is `R = v₀ cosα · t_v` with h = 0. */
const e1 = defineExercise<GroundLaunch>({
  id: 'e1',
  generate: (rng) => {
    const values = drawGroundLaunch(rng);
    return {
      values,
      answer: range_m(values.v0_mps, degToRad(values.launchAngle_deg), 0),
      unit: 'm',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: `H = h + (v₀ sinα)² / (2g)`. */
const e2 = defineExercise<RaisedLaunch>({
  id: 'e2',
  generate: (rng) => {
    const values = drawRaisedLaunch(rng);
    return {
      values,
      answer: maxHeight_m(values.v0_mps, degToRad(values.launchAngle_deg), values.h_m),
      unit: 'm',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e3: `t_v`, the positive root of `h + v₀ sinα · t − ½ g t² = 0`. */
const e3 = defineExercise<RaisedLaunch>({
  id: 'e3',
  generate: (rng) => {
    const values = drawRaisedLaunch(rng);
    return {
      values,
      answer: timeOfFlight_s(values.v0_mps, degToRad(values.launchAngle_deg), values.h_m),
      unit: 's',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: ABSOLUTE_10_MS,
});

/** e4: `R = v₀ cosα · t_v`, with the launch height h. */
const e4 = defineExercise<RaisedLaunch>({
  id: 'e4',
  generate: (rng) => {
    const values = drawRaisedLaunch(rng);
    return {
      values,
      answer: range_m(values.v0_mps, degToRad(values.launchAngle_deg), values.h_m),
      unit: 'm',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e5 (optional): the piece keeps the robot's vₓ while it falls, so `Δx = v · √(2h/g)`. */
const e5 = defineExercise<Record<string, never>>({
  id: 'e5',
  generate: () => ({ values: {}, answer: E5_V_MPS * freeFallTime(E5_H_M), unit: 'm' }),
  statement: () => statementKey('e5'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-1.4, in the order of Verifica; e1–e4 are required (only e5 is optional). */
export const exercises = [e1, e2, e3, e4, e5] as const;
