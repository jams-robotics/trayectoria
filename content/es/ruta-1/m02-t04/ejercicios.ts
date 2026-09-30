import { defineExercise, degToRad, G_MPS2 } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T1-2.4 (docs/CURRICULUM.md § T1-2.4). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (torques and radii to the thousandth,
// masses, lengths and efficiencies to the hundredth, ratios, teeth and angles whole), as in T1-1.2.
//
// Merged topic (docs/CURRICULUM.md, «Ejercicios del tema fusionado»): e1, e3 and e4 come from
// the Torque topic (its e1, e3 and e2) and e2 from the Transmission topic (its e3).

const TOPIC_ID = 'ruta-1/m02-t04';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const THOUSANDTHS = 1000;
const HUNDREDTHS = 100;
const UNITS = 1;

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
/** e2 range: teeth of each of the four gears. */
export const E2_TEETH: Range = { min: 8, max: 80 };
/** e3 draws φ in degrees, as the statement shows it. */
export const E3_SLOPE_DEG: Range = { min: 5, max: 30 };
export const E3_MASS_KG: Range = { min: 0.2, max: 3 };
export const E3_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
export const E4_WHEEL_TORQUE_NM: Range = { min: 0.05, max: 0.5 };
export const E4_WHEEL_RADIUS_M: Range = { min: 0.015, max: 0.05 };
/**
 * e1 and e3 draw again while τ is below this: with relative 2 %, a correct response rounded to the
 * thousandth (up to 0.0005 N·m off) is only accepted from 0.025 N·m on (#568).
 */
export const MIN_RELATIVE_ANSWER = 0.025;

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

/** e1: `τ_rueda = τ_motor · i · η`, drawn again while τ_rueda < 0.025 N·m (#568). */
const e1 = defineExercise<Gearmotor>({
  id: 'e1',
  generate: (rng) => {
    for (;;) {
      const motorTorque_Nm = drawOnGrid(rng, E1_MOTOR_TORQUE_NM, THOUSANDTHS);
      const gearRatio = drawOnGrid(rng, E1_GEAR_RATIO, UNITS);
      const efficiency = drawOnGrid(rng, E1_EFFICIENCY, HUNDREDTHS);
      const wheelTorque_Nm = motorTorque_Nm * gearRatio * efficiency;
      if (wheelTorque_Nm >= MIN_RELATIVE_ANSWER) {
        return {
          values: { motorTorque_Nm, gearRatio, efficiency },
          answer: wheelTorque_Nm,
          unit: 'N·m',
        };
      }
    }
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Train {
  readonly z1: number;
  readonly z2: number;
  readonly z3: number;
  readonly z4: number;
}

/**
 * The teeth of one stage, ordered so it reduces: the driving gear has fewer teeth than the driven
 * one. Equal teeth would not reduce, so they are drawn again (V-35).
 */
function drawStage(rng: SeededRng): readonly [number, number] {
  let first: number;
  let second: number;
  do {
    first = rng.nextInt(E2_TEETH.min, E2_TEETH.max);
    second = rng.nextInt(E2_TEETH.min, E2_TEETH.max);
  } while (first === second);
  return first < second ? [first, second] : [second, first];
}

/** e2: two stages, `i_total = i_1 · i_2 = (z_2/z_1) · (z_4/z_3)`, with z₂ > z₁ and z₄ > z₃; no unit. */
const e2 = defineExercise<Train>({
  id: 'e2',
  generate: (rng) => {
    const [z1, z2] = drawStage(rng);
    const [z3, z4] = drawStage(rng);
    return { values: { z1, z2, z3, z4 }, answer: (z2 / z1) * (z4 / z3), unit: '' };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Climb {
  readonly slope_deg: number;
  readonly mass_kg: number;
  readonly wheelRadius_m: number;
}

/**
 * e3: at constant speed each of the two driven wheels takes half of `mg·sinφ`, times `r`. Drawn
 * again while τ < 0.025 N·m (#568).
 */
const e3 = defineExercise<Climb>({
  id: 'e3',
  generate: (rng) => {
    for (;;) {
      const slope_deg = drawOnGrid(rng, E3_SLOPE_DEG, UNITS);
      const mass_kg = drawOnGrid(rng, E3_MASS_KG, HUNDREDTHS);
      const wheelRadius_m = drawOnGrid(rng, E3_WHEEL_RADIUS_M, THOUSANDTHS);
      const weightAlong_N = mass_kg * G_MPS2 * Math.sin(degToRad(slope_deg));
      const wheelTorque_Nm = (weightAlong_N / DRIVEN_WHEELS) * wheelRadius_m;
      if (wheelTorque_Nm >= MIN_RELATIVE_ANSWER) {
        return {
          values: { slope_deg, mass_kg, wheelRadius_m },
          answer: wheelTorque_Nm,
          unit: 'N·m',
        };
      }
    }
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Wheel {
  readonly wheelTorque_Nm: number;
  readonly wheelRadius_m: number;
}

/** e4 (optional): `F_rueda = τ_rueda / r`. */
const e4 = defineExercise<Wheel>({
  id: 'e4',
  generate: (rng) => {
    const wheelTorque_Nm = drawOnGrid(rng, E4_WHEEL_TORQUE_NM, THOUSANDTHS);
    const wheelRadius_m = drawOnGrid(rng, E4_WHEEL_RADIUS_M, THOUSANDTHS);
    return {
      values: { wheelTorque_Nm, wheelRadius_m },
      answer: wheelTorque_Nm / wheelRadius_m,
      unit: 'N',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T1-2.4, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
