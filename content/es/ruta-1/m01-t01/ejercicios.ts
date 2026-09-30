import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T1-1.1 (docs/CURRICULUM.md § T1-1.1). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (speeds to the hundredth, distances and
// times to the tenth), as in T1-0.3 (#273) and T1-1.2.

const TOPIC_ID = 'ruta-1/m01-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_DISTANCE_M: Range = { min: 1, max: 10 };
export const E1_V_MPS: Range = { min: 0.1, max: 1 };
export const E2_T_S: Range = { min: 2, max: 30 };
/** #315. */
export const E2_V_MPS: Range = { min: 0.1, max: 1 };
export const E3_VA_MPS: Range = { min: 0.3, max: 1 };
export const E3_VB_MPS: Range = { min: 0.1, max: 0.8 };
export const E3_DISTANCE_M: Range = { min: 1, max: 5 };
/** e3 draws v_A and v_B again while v_A − v_B is below this (#287). */
export const E3_MIN_DV_MPS = 0.1;
/** e3 draws everything again while the meeting is beyond this position (V-22). */
export const E3_MAX_MEETING_M = 10;
/** e4 is a fixed x–t line through these two points. */
export const E4_POINT_1 = { t_s: 1, x_m: 0.4 } as const;
export const E4_POINT_2 = { t_s: 3, x_m: 1.2 } as const;

/** The integer index of a value on the grid of step 1/`perUnit`, in [min, max]. */
function drawIndex(rng: SeededRng, range: Range, perUnit: number): number {
  return rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
}

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  return drawIndex(rng, range, perUnit) / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Track {
  readonly distance_m: number;
  readonly v_mps: number;
}

/** e1: a track of D m at constant v, so Δt = D / v. */
const e1 = defineExercise<Track>({
  id: 'e1',
  generate: (rng) => {
    const distance_m = drawOnGrid(rng, E1_DISTANCE_M, TENTHS);
    const v_mps = drawOnGrid(rng, E1_V_MPS, HUNDREDTHS);
    return { values: { distance_m, v_mps }, answer: distance_m / v_mps, unit: 's' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Cruise {
  readonly t_s: number;
  readonly v_mps: number;
}

/** e2: t s at constant v, so Δx = v · Δt. */
const e2 = defineExercise<Cruise>({
  id: 'e2',
  generate: (rng) => {
    const t_s = drawOnGrid(rng, E2_T_S, TENTHS);
    const v_mps = drawOnGrid(rng, E2_V_MPS, HUNDREDTHS);
    return { values: { t_s, v_mps }, answer: v_mps * t_s, unit: 'm' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Meeting {
  readonly vA_mps: number;
  readonly vB_mps: number;
  readonly distance_m: number;
}

/**
 * e3: A starts at 0 with v_A, B starts D ahead with v_B. Equal positions, v_A·t = D + v_B·t, give
 * t = D / (v_A − v_B) and x = v_A·t. A small v_A − v_B makes the meeting too far, and v_A ≤ v_B
 * never meets, so both are drawn again while v_A − v_B < 0.1 m/s (#287). A meeting beyond 10 m
 * draws v_A, v_B and D again (V-22).
 */
const e3 = defineExercise<Meeting>({
  id: 'e3',
  generate: (rng) => {
    // Compared on the integer indices, so exactly 0.1 m/s and exactly 10 m are kept:
    // x = v_A·D / (v_A − v_B) = vA_cmps·distance_dm / (10·dv_cmps).
    const minDv_cmps = Math.round(E3_MIN_DV_MPS * HUNDREDTHS);
    let vA_cmps = 0;
    let vB_cmps = 0;
    let distance_dm = 0;
    do {
      do {
        vA_cmps = drawIndex(rng, E3_VA_MPS, HUNDREDTHS);
        vB_cmps = drawIndex(rng, E3_VB_MPS, HUNDREDTHS);
      } while (vA_cmps - vB_cmps < minDv_cmps);
      distance_dm = drawIndex(rng, E3_DISTANCE_M, TENTHS);
    } while (vA_cmps * distance_dm > E3_MAX_MEETING_M * TENTHS * (vA_cmps - vB_cmps));
    const vA_mps = vA_cmps / HUNDREDTHS;
    const vB_mps = vB_cmps / HUNDREDTHS;
    const distance_m = distance_dm / TENTHS;
    const t_s = distance_m / (vA_mps - vB_mps);
    return {
      values: { vA_mps, vB_mps, distance_m },
      answer: [t_s, vA_mps * t_s],
      unit: ['s', 'm'],
      labels: [`content.${TOPIC_ID}.labels.e3.0`, `content.${TOPIC_ID}.labels.e3.1`],
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional): the slope of the fixed x–t line, v = Δx / Δt. No generation range. */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({
    values: {},
    answer: (E4_POINT_2.x_m - E4_POINT_1.x_m) / (E4_POINT_2.t_s - E4_POINT_1.t_s),
    unit: 'm/s',
  }),
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T1-1.1, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
