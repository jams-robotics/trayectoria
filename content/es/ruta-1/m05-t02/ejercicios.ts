import { defineExercise } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-5.2 (docs/CURRICULUM.md § T-5.2, #394). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// r and L are fixed to the reference robot from e1 to e4. Angular velocities and times are drawn
// in tenths, so the statement shows them exactly, as in T-0.3 (#273).

const TOPIC_ID = 'ruta-1/m05-t02';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Wheels of the reference robot, fixed in every exercise (#394). */
export const WHEEL_RADIUS_M = 0.032;
export const WHEEL_BASE_M = 0.15;

/** Generation ranges of the spec, in the units the statements announce. */
export const E1_OMEGA_RADPS: Range = { min: 0, max: 20 };
/**
 * e1 draws again while v or ω is nonzero and closer to 0 than this: with relative 2 %, a correct
 * response rounded to the thousandth would be rejected (#451). An exact 0 stays: `check` grades
 * it with the absolute error.
 */
export const E1_MIN_NONZERO_V_MPS = 0.01;
export const E1_MIN_NONZERO_OMEGA_RADPS = 0.01;
/** e2 draws again while the wheels are closer than this: the CIR would be too far away. */
export const E2_MIN_WHEEL_DIFFERENCE_RADPS = 1;
/** e3 and e4 draw ω_R; the left wheel spins at ω_L = −ω_R. */
export const E3_OMEGA_RADPS: Range = { min: 2, max: 20 };
export const E4_OMEGA_RADPS: Range = { min: 2, max: 20 };
export const E4_T_S: Range = { min: 1, max: 5 };

/** A value on the grid of step 1/10, in [min, max]. */
function drawTenths(rng: SeededRng, range: Range): number {
  return rng.nextInt(Math.round(range.min * TENTHS), Math.round(range.max * TENTHS)) / TENTHS;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** True for a nonzero value closer to 0 than `min`, which relative 2 % grades too tightly (#451). */
function isSmallNonzero(value: number, min: number): boolean {
  return value !== 0 && Math.abs(value) < min;
}

interface Wheels {
  readonly omegaL_radps: number;
  readonly omegaR_radps: number;
}

/** `v = (v_R + v_L) / 2`, with `v = ω·r` for each wheel. */
function robotVelocity_mps({ omegaL_radps, omegaR_radps }: Wheels): number {
  return ((omegaR_radps + omegaL_radps) * WHEEL_RADIUS_M) / 2;
}

/** `ω = (v_R − v_L) / L`, with `v = ω·r` for each wheel. */
function robotOmega_radps({ omegaL_radps, omegaR_radps }: Wheels): number {
  return ((omegaR_radps - omegaL_radps) * WHEEL_RADIUS_M) / WHEEL_BASE_M;
}

function drawWheels(rng: SeededRng): Wheels {
  return {
    omegaL_radps: drawTenths(rng, E1_OMEGA_RADPS),
    omegaR_radps: drawTenths(rng, E1_OMEGA_RADPS),
  };
}

/** A spin in place: ω_R drawn in `range`, ω_L = −ω_R. */
function drawSpin(rng: SeededRng, range: Range): Wheels {
  const omegaR_radps = drawTenths(rng, range);
  return { omegaL_radps: -omegaR_radps, omegaR_radps };
}

/** e1: v and ω of the robot from both wheels. */
const e1 = defineExercise<Wheels>({
  id: 'e1',
  generate: (rng) => {
    let wheels = drawWheels(rng);
    while (
      isSmallNonzero(robotVelocity_mps(wheels), E1_MIN_NONZERO_V_MPS) ||
      isSmallNonzero(robotOmega_radps(wheels), E1_MIN_NONZERO_OMEGA_RADPS)
    ) {
      wheels = drawWheels(rng);
    }
    return {
      values: wheels,
      answer: [robotVelocity_mps(wheels), robotOmega_radps(wheels)],
      unit: ['m/s', 'rad/s'],
    };
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e2: signed turn radius `R = v / ω`, positive with the CIR on the left (ω > 0). */
const e2 = defineExercise<Wheels>({
  id: 'e2',
  generate: (rng) => {
    let wheels = drawWheels(rng);
    while (Math.abs(wheels.omegaR_radps - wheels.omegaL_radps) < E2_MIN_WHEEL_DIFFERENCE_RADPS) {
      wheels = drawWheels(rng);
    }
    return {
      values: wheels,
      answer: robotVelocity_mps(wheels) / robotOmega_radps(wheels),
      unit: 'm',
    };
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

/** e3: spin in place, `ω = 2·ω_R·r / L`. */
const e3 = defineExercise<Wheels>({
  id: 'e3',
  generate: (rng) => {
    const wheels = drawSpin(rng, E3_OMEGA_RADPS);
    return { values: wheels, answer: robotOmega_radps(wheels), unit: 'rad/s' };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface TimedSpin extends Wheels {
  readonly t_s: number;
}

/** e4 (optional): spin in place during t, `θ − θ₀ = ω·t`. */
const e4 = defineExercise<TimedSpin>({
  id: 'e4',
  generate: (rng) => {
    const wheels = drawSpin(rng, E4_OMEGA_RADPS);
    const t_s = drawTenths(rng, E4_T_S);
    return { values: { ...wheels, t_s }, answer: robotOmega_radps(wheels) * t_s, unit: 'rad' };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-5.2, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
