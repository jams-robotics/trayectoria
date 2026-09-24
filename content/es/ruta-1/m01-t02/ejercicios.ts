import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-1.2 (docs/CURRICULUM.md § T-1.2). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (speeds, accelerations and lengths to the
// hundredth, times to the tenth), as in T-0.3 (#273).

const TOPIC_ID = 'ruta-1/m01-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_V_MPS: Range = { min: 0.2, max: 1 };
export const E1_T_S: Range = { min: 0.5, max: 3 };
export const E2_V0_MPS: Range = { min: 0.2, max: 1 };
/** e2 draws |a|; the robot brakes with a = −|a|. */
export const E2_A_MAGNITUDE_MPS2: Range = { min: 0.5, max: 3 };
export const E3_A_MPS2: Range = { min: 0.2, max: 2 };
export const E3_DX_M: Range = { min: 0.2, max: 2 };
/** e4 is a fixed track: 4 m, accelerating at 0.4 m/s² up to 0.6 m/s, then constant. */
export const E4_DX_M = 4;
export const E4_A_MPS2 = 0.4;
export const E4_V_MPS = 0.6;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface RampFromRest {
  readonly v_mps: number;
  readonly t_s: number;
}

/** e1: from rest to v in t, so a = v/t and x = ½·a·t² = v·t/2. */
const e1 = defineExercise<RampFromRest>({
  id: 'e1',
  generate: (rng) => {
    const v_mps = drawOnGrid(rng, E1_V_MPS, HUNDREDTHS);
    const t_s = drawOnGrid(rng, E1_T_S, TENTHS);
    const a_mps2 = v_mps / t_s;
    return {
      values: { v_mps, t_s },
      answer: [a_mps2, (a_mps2 * t_s ** 2) / 2],
      unit: ['m/s²', 'm'],
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Braking {
  readonly v0_mps: number;
  readonly a_mps2: number;
}

/** e2: braking from v₀ to rest, v² = v₀² + 2·a·Δx with v = 0, so Δx = v₀² / (2·|a|). */
const e2 = defineExercise<Braking>({
  id: 'e2',
  generate: (rng) => {
    const v0_mps = drawOnGrid(rng, E2_V0_MPS, HUNDREDTHS);
    const a_mps2 = -drawOnGrid(rng, E2_A_MAGNITUDE_MPS2, HUNDREDTHS);
    return { values: { v0_mps, a_mps2 }, answer: v0_mps ** 2 / (2 * -a_mps2), unit: 'm' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface DistanceFromRest {
  readonly a_mps2: number;
  readonly dx_m: number;
}

/** e3: from rest, Δx = ½·a·t², so t = √(2·Δx / a). */
const e3 = defineExercise<DistanceFromRest>({
  id: 'e3',
  generate: (rng) => {
    const a_mps2 = drawOnGrid(rng, E3_A_MPS2, HUNDREDTHS);
    const dx_m = drawOnGrid(rng, E3_DX_M, HUNDREDTHS);
    return { values: { a_mps2, dx_m }, answer: Math.sqrt((2 * dx_m) / a_mps2), unit: 's' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** Total time of the e4 track: a ramp from rest up to v, then cruise at v for the rest. */
function rampAndCruiseTime_s(dx_m: number, a_mps2: number, v_mps: number): number {
  const ramp_s = v_mps / a_mps2;
  const rampDx_m = v_mps ** 2 / (2 * a_mps2);
  return ramp_s + (dx_m - rampDx_m) / v_mps;
}

/** e4 (optional): fixed track of 4 m, no generation range. */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({
    values: {},
    answer: rampAndCruiseTime_s(E4_DX_M, E4_A_MPS2, E4_V_MPS),
    unit: 's',
  }),
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-1.2, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
