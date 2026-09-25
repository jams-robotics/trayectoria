import { defineExercise, G_MPS2 } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-3.1 (docs/CURRICULUM.md § T-3.1). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (masses, speeds and forces to the
// hundredth, distances to the tenth), as in T-0.3 (#273).

const TOPIC_ID = 'ruta-1/m03-t01';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const HUNDREDTHS = 100;
const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_MASS_KG: Range = { min: 0.2, max: 3 };
export const E1_V_MPS: Range = { min: 0.1, max: 1.5 };
export const E2_V_MPS: Range = { min: 0.1, max: 1.5 };
export const E3_MASS_KG: Range = { min: 0.2, max: 3 };
export const E3_V_MPS: Range = { min: 0.1, max: 1.5 };
export const E4_FRICTION_N: Range = { min: 0.1, max: 1 };
export const E4_DISTANCE_M: Range = { min: 1, max: 10 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** `E_k = ½·m·v²`, in joules. */
function kineticEnergy_J(mass_kg: number, v_mps: number): number {
  return (mass_kg * v_mps ** 2) / 2;
}

interface MassAndSpeed {
  readonly mass_kg: number;
  readonly v_mps: number;
}

function drawMassAndSpeed(rng: SeededRng, mass: Range, speed: Range): MassAndSpeed {
  const mass_kg = drawOnGrid(rng, mass, HUNDREDTHS);
  const v_mps = drawOnGrid(rng, speed, HUNDREDTHS);
  return { mass_kg, v_mps };
}

/** e1: kinetic energy of m at v, `E_k = ½·m·v²`. */
const e1 = defineExercise<MassAndSpeed>({
  id: 'e1',
  generate: (rng) => {
    const values = drawMassAndSpeed(rng, E1_MASS_KG, E1_V_MPS);
    return { values, answer: kineticEnergy_J(values.mass_kg, values.v_mps), unit: 'J' };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Speed {
  readonly v_mps: number;
}

/** e2: height reached by inertia without friction, `h_max = v² / (2g)`. */
const e2 = defineExercise<Speed>({
  id: 'e2',
  generate: (rng) => {
    const v_mps = drawOnGrid(rng, E2_V_MPS, HUNDREDTHS);
    return { values: { v_mps }, answer: v_mps ** 2 / (2 * G_MPS2), unit: 'm' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e3: net work to take m from rest to v, `W_neto = ΔE_k = ½·m·v²`. */
const e3 = defineExercise<MassAndSpeed>({
  id: 'e3',
  generate: (rng) => {
    const values = drawMassAndSpeed(rng, E3_MASS_KG, E3_V_MPS);
    return { values, answer: kineticEnergy_J(values.mass_kg, values.v_mps), unit: 'J' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface FrictionAlongDistance {
  readonly friction_N: number;
  readonly distance_m: number;
}

/** e4 (optional): energy a rolling friction f dissipates along D, `f·D` (θ = π, so `|W| = f·D`). */
const e4 = defineExercise<FrictionAlongDistance>({
  id: 'e4',
  generate: (rng) => {
    const friction_N = drawOnGrid(rng, E4_FRICTION_N, HUNDREDTHS);
    const distance_m = drawOnGrid(rng, E4_DISTANCE_M, TENTHS);
    return { values: { friction_N, distance_m }, answer: friction_N * distance_m, unit: 'J' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-3.1, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
