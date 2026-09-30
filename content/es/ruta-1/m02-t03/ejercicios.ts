import { defineExercise, G_MPS2 } from '@trayectoria/sim-core';
import type { SeededRng } from '@trayectoria/sim-core';

// Verifica of T1-2.3 (docs/CURRICULUM.md § T1-2.3). Each exercise returns only the key of its
// statement; the text lives in packages/i18n/locales/es/content.json (ARCHITECTURE §3.3).
//
// Values are drawn on a grid the statement shows exactly (rpm as integers, times to the tenth,
// speeds, radii of curve, α and μs to the hundredth, wheel radii to the millimetre).

const TOPIC_ID = 'ruta-1/m02-t03';
const RELATIVE_2_PERCENT = { type: 'relative', value: 0.02 } as const;

const UNITS = 1;
const TENTHS = 10;
const HUNDREDTHS = 100;
const THOUSANDTHS = 1000;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Generation ranges of the spec (#301), in the units the statements announce. */
export const E1_SPEED_RPM: Range = { min: 60, max: 600 };
export const E1_T_S: Range = { min: 0.1, max: 2 };
export const E2_V_MPS: Range = { min: 0.2, max: 1.5 };
export const E2_R_M: Range = { min: 0.1, max: 2 };
export const E3_ALPHA_RADPS2: Range = { min: 10, max: 100 };
export const E3_R_M: Range = { min: 0.015, max: 0.05 };
export const E4_MU_S: Range = { min: 0.2, max: 1 };
export const E4_R_M: Range = { min: 0.1, max: 2 };
/**
 * e1 and e2 say «tu robot», so the reference robot bounds them (#570.1b): its wheel turns at most
 * at the no-load 6000/30 = 200 rpm (T1-1.4), its top speed is v_max = 0.670 m/s and it takes a
 * curve without skidding while a_c ≤ μs·β·g, with μs = 0.6 and β = 0.6 (T1-2.2). The ranges of the
 * spec stay; a draw beyond a bound is drawn again, and the golden values lie within all three.
 */
export const E1_MAX_WHEEL_SPEED_RPM = 200;
export const E2_MAX_V_MPS = 0.67;
export const E2_MAX_CENTRIPETAL_MPS2 = 0.6 * 0.6 * G_MPS2;
/**
 * e2 draws again while a_c is below this: with relative 2 %, a correct response rounded to the
 * thousandth (up to 0.0005 m/s² off) is only accepted from 0.025 m/s² on (#568).
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

interface SpinUp {
  readonly speed_rpm: number;
  readonly t_s: number;
}

/**
 * e1: from rest to n rpm in t, `α = Δω/Δt = (n · 2π/60) / t`; n drawn again above the 200 rpm of
 * the reference robot's wheel (#570.1b).
 */
const e1 = defineExercise<SpinUp>({
  id: 'e1',
  generate: (rng) => {
    for (;;) {
      const speed_rpm = drawOnGrid(rng, E1_SPEED_RPM, UNITS);
      const t_s = drawOnGrid(rng, E1_T_S, TENTHS);
      if (speed_rpm <= E1_MAX_WHEEL_SPEED_RPM) {
        return {
          values: { speed_rpm, t_s },
          answer: (speed_rpm * RPM_TO_RADPS) / t_s,
          unit: 'rad/s²',
        };
      }
    }
  },
  statement: () => statementKey('e1'),
  tolerance: RELATIVE_2_PERCENT,
});

interface Curve {
  readonly v_mps: number;
  readonly turnRadius_m: number;
}

/**
 * e2: `a_c = v²/R`, drawn again while a_c < 0.025 m/s² (#568), and beyond the reference robot:
 * v above 0.670 m/s or a_c above μs·β·g (#570.1b).
 */
const e2 = defineExercise<Curve>({
  id: 'e2',
  generate: (rng) => {
    for (;;) {
      const v_mps = drawOnGrid(rng, E2_V_MPS, HUNDREDTHS);
      const turnRadius_m = drawOnGrid(rng, E2_R_M, HUNDREDTHS);
      const centripetal_mps2 = v_mps ** 2 / turnRadius_m;
      const withinRobot = v_mps <= E2_MAX_V_MPS && centripetal_mps2 <= E2_MAX_CENTRIPETAL_MPS2;
      if (withinRobot && centripetal_mps2 >= MIN_RELATIVE_ANSWER) {
        return { values: { v_mps, turnRadius_m }, answer: centripetal_mps2, unit: 'm/s²' };
      }
    }
  },
  statement: () => statementKey('e2'),
  tolerance: RELATIVE_2_PERCENT,
});

interface WheelRim {
  readonly alpha_radps2: number;
  readonly wheelRadius_m: number;
}

/** e3: tangential acceleration of the rim, `a_t = α · r`. */
const e3 = defineExercise<WheelRim>({
  id: 'e3',
  generate: (rng) => {
    const alpha_radps2 = drawOnGrid(rng, E3_ALPHA_RADPS2, HUNDREDTHS);
    const wheelRadius_m = drawOnGrid(rng, E3_R_M, THOUSANDTHS);
    return {
      values: { alpha_radps2, wheelRadius_m },
      answer: alpha_radps2 * wheelRadius_m,
      unit: 'm/s²',
    };
  },
  statement: () => statementKey('e3'),
  tolerance: RELATIVE_2_PERCENT,
});

interface GripCurve {
  readonly mu_s: number;
  readonly turnRadius_m: number;
}

/** e4 (optional): friction supplies `a_c`, so `v_max,curva = √(μs · g · R)`. */
const e4 = defineExercise<GripCurve>({
  id: 'e4',
  generate: (rng) => {
    const mu_s = drawOnGrid(rng, E4_MU_S, HUNDREDTHS);
    const turnRadius_m = drawOnGrid(rng, E4_R_M, HUNDREDTHS);
    return {
      values: { mu_s, turnRadius_m },
      answer: Math.sqrt(mu_s * G_MPS2 * turnRadius_m),
      unit: 'm/s',
    };
  },
  statement: () => statementKey('e4'),
  tolerance: RELATIVE_2_PERCENT,
});

/** The exercises of T1-2.3, in the order of Verifica; e1–e3 are required. */
export const exercises = [e1, e2, e3, e4] as const;
