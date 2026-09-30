import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T1-1.4 (docs/CURRICULUM.md § T1-1.4): the chain of «Mi robot» closes here,
 * `n_rueda = n_motor / i` (the datum of T1-1.3) and `v_max = ω_max · r`, with the `ω_rueda` that
 * T1-1.3 calculates, cited and not recalculated (#565). The MDX renders them with
 * `<RobotFormula calc="ruta-1/m01-t04/wheel-speed" />` and `…/v-max`. They use only required
 * fields of RobotSpec.
 */

/** Four significant figures for n_rueda and ω_max (200 rpm, 20.94 rad/s), as in T1-1.3. */
const ROTATION_SIGNIFICANT_FIGURES = 4;

/** Three significant figures, keeping trailing zeros: 0.670 m/s. */
const SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Wheels of the reference robot (docs/CURRICULUM.md, header: 6000 rpm, i = 30, r = 0.032 m).
 * `content` takes robot-spec for its types only (#246), so the numbers are written here.
 */
const REFERENCE_WHEELS = { maxMotorSpeed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;

interface Chain {
  readonly motorSpeed_rpm: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly wheelSpeed_rpm: number;
  readonly omegaMax_radps: number;
  readonly vMax_mps: number;
}

/**
 * The chain of the profile: motor speed, reduction and wheel radius, all required in RobotSpec.
 * An arm profile has no wheels, so it falls back to the reference robot
 * (docs/CONTENT-STANDARDS.md §2.5).
 */
function chain(robot: RobotSpec): Chain {
  const { maxMotorSpeed_rpm, gearRatio, wheelRadius_m } = robot.mobile ?? REFERENCE_WHEELS;
  const wheelSpeed_rpm = maxMotorSpeed_rpm / gearRatio;
  const omegaMax_radps = wheelSpeed_rpm * RPM_TO_RADPS;
  return {
    motorSpeed_rpm: maxMotorSpeed_rpm,
    gearRatio,
    wheelRadius_m,
    wheelSpeed_rpm,
    omegaMax_radps,
    vMax_mps: omegaMax_radps * wheelRadius_m,
  };
}

function formatRotation(value: number): string {
  return String(Number(value.toPrecision(ROTATION_SIGNIFICANT_FIGURES)));
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `n_rueda = n_motor / i`. */
export const wheelSpeed: RobotCalc = {
  id: 'wheel-speed',
  compute(robot) {
    const { motorSpeed_rpm, gearRatio, wheelSpeed_rpm } = chain(robot);
    return {
      latex: String.raw`n_{rueda} = \dfrac{n_{motor}}{i}`,
      substituted:
        String.raw`n_{rueda} = \dfrac{${motorSpeed_rpm}\ \text{rpm}}{${gearRatio}}` +
        String.raw` = ${formatRotation(wheelSpeed_rpm)}\ \text{rpm}`,
    };
  },
};

/** `v_max = ω_max · r`, with `ω_max` the no-load `ω_rueda` of T1-1.3. */
export const vMax: RobotCalc = {
  id: 'v-max',
  compute(robot) {
    const { omegaMax_radps, wheelRadius_m, vMax_mps } = chain(robot);
    return {
      latex: String.raw`v_{\max} = \omega_{\max} \cdot r`,
      substituted:
        String.raw`v_{\max} = ${formatRotation(omegaMax_radps)}\ \text{rad/s} \cdot ${wheelRadius_m}\ \text{m}` +
        String.raw` = ${format(vMax_mps)}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelSpeed, vMax];
