import { defineExercise, G_MPS2 } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-2.3 (docs/CURRICULUM.md § T-2.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (torques and radii to the thousandth,
// masses, lengths and efficiencies to the hundredth, ratios and angles whole), as in T-1.2.

const TOPIC_ID = 'ruta-1/m02-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const THOUSANDTHS = 1000;
const HUNDREDTHS = 100;
const UNITS = 1;
const DEG_TO_RAD = Math.PI / 180;

/** Driven wheels that share the climb in e3. */
const DRIVEN_WHEELS = 2;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_MOTOR_TORQUE_NM: Range = { min: 0.005, max: 0.1 };
export const E1_GEAR_RATIO: Range = { min: 5, max: 100 };
export const E1_EFFICIENCY: Range = { min: 0.5, max: 0.9 };
export const E2_WHEEL_TORQUE_NM: Range = { min: 0.05, max: 0.5 };
export const E2_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
/** e3 draws φ in degrees, as the statement shows it. */
export const E3_SLOPE_DEG: Range = { min: 5, max: 30 };
export const E3_MASS_KG: Range = { min: 0.2, max: 3 };
export const E3_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
export const E4_LEVER_ARM_M: Range = { min: 0.1, max: 0.35 };
export const E4_MASS_KG: Range = { min: 0.1, max: 1 };

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

interface Gearmotor {
  readonly motorTorque_Nm: number;
  readonly gearRatio: number;
  readonly efficiency: number;
}

/** e1: `τ_rueda = τ_motor · i · η`. */
const e1 = defineExercise<Gearmotor>({
  id: 'e1',
  generate: (rng) => {
    const motorTorque_Nm = drawOnGrid(rng, E1_MOTOR_TORQUE_NM, THOUSANDTHS);
    const gearRatio = drawOnGrid(rng, E1_GEAR_RATIO, UNITS);
    const efficiency = drawOnGrid(rng, E1_EFFICIENCY, HUNDREDTHS);
    return {
      values: { motorTorque_Nm, gearRatio, efficiency },
      answer: motorTorque_Nm * gearRatio * efficiency,
      unit: 'N·m',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Wheel {
  readonly wheelTorque_Nm: number;
  readonly wheelRadius_m: number;
}

/** e2: `F_rueda = τ_rueda / r`. */
const e2 = defineExercise<Wheel>({
  id: 'e2',
  generate: (rng) => {
    const wheelTorque_Nm = drawOnGrid(rng, E2_WHEEL_TORQUE_NM, THOUSANDTHS);
    const wheelRadius_m = drawOnGrid(rng, E2_WHEEL_RADIUS_M, THOUSANDTHS);
    return {
      values: { wheelTorque_Nm, wheelRadius_m },
      answer: wheelTorque_Nm / wheelRadius_m,
      unit: 'N',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Climb {
  readonly slope_deg: number;
  readonly mass_kg: number;
  readonly wheelRadius_m: number;
}

/** e3: at constant speed each of the two driven wheels takes half of `mg·sinφ`, times `r`. */
const e3 = defineExercise<Climb>({
  id: 'e3',
  generate: (rng) => {
    const slope_deg = drawOnGrid(rng, E3_SLOPE_DEG, UNITS);
    const mass_kg = drawOnGrid(rng, E3_MASS_KG, HUNDREDTHS);
    const wheelRadius_m = drawOnGrid(rng, E3_WHEEL_RADIUS_M, THOUSANDTHS);
    const weightAlong_N = mass_kg * G_MPS2 * Math.sin(slope_deg * DEG_TO_RAD);
    return {
      values: { slope_deg, mass_kg, wheelRadius_m },
      answer: (weightAlong_N / DRIVEN_WHEELS) * wheelRadius_m,
      unit: 'N·m',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Arm {
  readonly leverArm_m: number;
  readonly mass_kg: number;
}

/** e4 (optional): a horizontal arm holding `m` at its tip, `τ = m·g·ℓ`. */
const e4 = defineExercise<Arm>({
  id: 'e4',
  generate: (rng) => {
    const leverArm_m = drawOnGrid(rng, E4_LEVER_ARM_M, HUNDREDTHS);
    const mass_kg = drawOnGrid(rng, E4_MASS_KG, HUNDREDTHS);
    return { values: { leverArm_m, mass_kg }, answer: mass_kg * G_MPS2 * leverArm_m, unit: 'N·m' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-2.3, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
