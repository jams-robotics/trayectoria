import { defineExercise, degToRad, G_MPS2 } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-2.1 (docs/CURRICULUM.md § T-2.1). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (masses and accelerations to the
// hundredth, slopes to the whole degree), as in T-1.2. Slopes are asked in degrees, as the spec
// writes them.

const TOPIC_ID = 'ruta-1/m02-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const WHOLE_UNITS = 1;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_MASS_KG: Range = { min: 0.2, max: 3 };
export const E1_A_MPS2: Range = { min: 0.2, max: 3 };
export const E2_MASS_KG: Range = { min: 0.2, max: 3 };
export const E3_MASS_KG: Range = { min: 0.2, max: 3 };
export const E3_SLOPE_DEG: Range = { min: 5, max: 30 };
/** e4 is fixed: traction 1.5 N and rolling friction 0.4 N on a 0.9 kg robot. */
export const E4_TRACTION_N = 1.5;
export const E4_FRICTION_N = 0.4;
export const E4_MASS_KG = 0.9;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface NetForce {
  readonly mass_kg: number;
  readonly a_mps2: number;
}

/** e1: `ΣF = m·a`. */
const e1 = defineExercise<NetForce>({
  id: 'e1',
  generate: (rng) => {
    const mass_kg = drawOnGrid(rng, E1_MASS_KG, HUNDREDTHS);
    const a_mps2 = drawOnGrid(rng, E1_A_MPS2, HUNDREDTHS);
    return { values: { mass_kg, a_mps2 }, answer: mass_kg * a_mps2, unit: 'N' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Flat {
  readonly mass_kg: number;
}

/** e2: on flat ground, `N = m·g`. */
const e2 = defineExercise<Flat>({
  id: 'e2',
  generate: (rng) => {
    const mass_kg = drawOnGrid(rng, E2_MASS_KG, HUNDREDTHS);
    return { values: { mass_kg }, answer: mass_kg * G_MPS2, unit: 'N' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Ramp {
  readonly mass_kg: number;
  readonly slope_deg: number;
}

/** e3: on a ramp, `F_∥ = m·g·sinφ` along it and `N = m·g·cosφ`, as `[F_∥, N]`. */
const e3 = defineExercise<Ramp>({
  id: 'e3',
  generate: (rng) => {
    const mass_kg = drawOnGrid(rng, E3_MASS_KG, HUNDREDTHS);
    const slope_deg = drawOnGrid(rng, E3_SLOPE_DEG, WHOLE_UNITS);
    const slope_rad = degToRad(slope_deg);
    const weight_N = mass_kg * G_MPS2;
    return {
      values: { mass_kg, slope_deg },
      answer: [weight_N * Math.sin(slope_rad), weight_N * Math.cos(slope_rad)],
      unit: 'N',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e4 (optional): fixed forces along one line, `a = (traction − friction) / m`. */
const e4 = defineExercise<Record<string, never>>({
  id: 'e4',
  generate: () => ({
    values: {},
    answer: (E4_TRACTION_N - E4_FRICTION_N) / E4_MASS_KG,
    unit: 'm/s²',
  }),
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-2.1, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
