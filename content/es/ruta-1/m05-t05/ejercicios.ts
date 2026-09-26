import { defineExercise, degToRad } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T-5.5 (docs/CURRICULUM.md § T-5.5, #394). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (angles in whole degrees, speeds and
// distances to the hundredth, angular velocities to the tenth), as in T-0.3 (#273). The speed of
// e1 goes to the ten-thousandth so that the golden value of the spec, 0.4243 m/s, is on the grid.

const TOPIC_ID = 'ruta-1/m05-t05';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;
/** e1: the golden value is 0, so the spec grades it with an absolute 0.01 m/s (#394). */
const ABSOLUTE_1_CMPS = { type: 'absolute', value: 0.01 } as const;

const WHOLE = 1;
const TEN_THOUSANDTHS = 10000;
const HUNDREDTHS = 100;
const TENTHS = 10;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec, in the units the statements announce. θ ∈ [0°, 360°). */
export const E1_THETA_DEG: Range = { min: 0, max: 359 };
export const E1_V_MPS: Range = { min: 0.1, max: 0.6 };
export const E2_THETA_DEG: Range = { min: 0, max: 359 };
/** Range of each component of (ẋ, ẏ). */
export const E2_VELOCITY_MPS: Range = { min: -0.5, max: 0.5 };
/** e2 draws again while the value of the constraint is this close to 0. */
export const E2_MIN_ABS_CONSTRAINT_MPS = 0.05;
export const E3_DISTANCE_M: Range = { min: 0.1, max: 0.5 };
export const E3_OMEGA_RADPS: Range = { min: 2, max: 6 };
export const E3_V_MPS: Range = { min: 0.2, max: 0.6 };

/** Turn of each in-place rotation of the lateral maneuver: 90°. */
const QUARTER_TURN_RAD = Math.PI / 2;

/** A value on the grid of step 1/`perUnit`, in [min, max]. */
function drawOnGrid(rng: SeededRng, range: Range, perUnit: number): number {
  const index = rng.nextInt(Math.round(range.min * perUnit), Math.round(range.max * perUnit));
  return index / perUnit;
}

function statementKey(exerciseId: string): string {
  return `content.${TOPIC_ID}.${exerciseId}`;
}

/** Value of the no-slip constraint, `ẋ sinθ − ẏ cosθ`: 0 for an admissible velocity. */
function constraint_mps(theta_deg: number, vx_mps: number, vy_mps: number): number {
  const theta_rad = degToRad(theta_deg);
  return vx_mps * Math.sin(theta_rad) - vy_mps * Math.cos(theta_rad);
}

interface HeadingSpeed {
  readonly theta_deg: number;
  readonly v_mps: number;
}

/** e1: `(ẋ, ẏ) = v·(cosθ, sinθ)` always satisfies the constraint, so the value is 0. */
const e1 = defineExercise<HeadingSpeed>({
  id: 'e1',
  generate: (rng) => {
    const theta_deg = drawOnGrid(rng, E1_THETA_DEG, WHOLE);
    const v_mps = drawOnGrid(rng, E1_V_MPS, TEN_THOUSANDTHS);
    const theta_rad = degToRad(theta_deg);
    const vx_mps = v_mps * Math.cos(theta_rad);
    const vy_mps = v_mps * Math.sin(theta_rad);
    return {
      values: { theta_deg, v_mps },
      answer: constraint_mps(theta_deg, vx_mps, vy_mps),
      unit: 'm/s',
    };
  },
  statement: () => statementKey('e1'),
  tolerance: ABSOLUTE_1_CMPS,
});

interface HeadingVelocity {
  readonly theta_deg: number;
  readonly vx_mps: number;
  readonly vy_mps: number;
}

/** e2: the value of the constraint for a given (ẋ, ẏ), drawn away from 0 (not admissible). */
const e2 = defineExercise<HeadingVelocity>({
  id: 'e2',
  generate: (rng) => {
    for (;;) {
      const theta_deg = drawOnGrid(rng, E2_THETA_DEG, WHOLE);
      const vx_mps = drawOnGrid(rng, E2_VELOCITY_MPS, HUNDREDTHS);
      const vy_mps = drawOnGrid(rng, E2_VELOCITY_MPS, HUNDREDTHS);
      const value_mps = constraint_mps(theta_deg, vx_mps, vy_mps);
      if (Math.abs(value_mps) >= E2_MIN_ABS_CONSTRAINT_MPS) {
        return { values: { theta_deg, vx_mps, vy_mps }, answer: value_mps, unit: 'm/s' };
      }
    }
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface LateralManeuver {
  readonly distance_m: number;
  readonly omega_radps: number;
  readonly v_mps: number;
}

/** e3: turn 90° at ω, advance D at v, turn −90°: `t = 2·(π/2)/ω + D/v`. */
const e3 = defineExercise<LateralManeuver>({
  id: 'e3',
  generate: (rng) => {
    const distance_m = drawOnGrid(rng, E3_DISTANCE_M, HUNDREDTHS);
    const omega_radps = drawOnGrid(rng, E3_OMEGA_RADPS, TENTHS);
    const v_mps = drawOnGrid(rng, E3_V_MPS, HUNDREDTHS);
    return {
      values: { distance_m, omega_radps, v_mps },
      answer: (2 * QUARTER_TURN_RAD) / omega_radps + distance_m / v_mps,
      unit: 's',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T-5.5, in the order of Verifica; the spec has only e1–e3, all required. */
export const exercises = [e1, e2, e3] as const;
