import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-4.2 (docs/CURRICULUM.md § T-4.2): `v_max` of «Mi robot» through the whole
 * chain, `n_motor → n_rueda → ω_max → v_max`, and the time for a 4 m track at that speed. The MDX
 * renders them with `<RobotFormula calc="ruta-1/m04-t02/wheel-speed" />`, `…/omega-max`,
 * `…/v-max` and `…/track-time`. They use only required fields of RobotSpec.
 */

/** Four significant figures for n_rueda and ω_max (200 rpm, 20.94 rad/s), as in T-0.1. */
const ROTATION_SIGNIFICANT_FIGURES = 4;

/** Three significant figures, keeping trailing zeros: 0.670 m/s, 5.97 s. */
const SIGNIFICANT_FIGURES = 3;

/** Length of the track of the spec: «pista de 4 m». */
const TRACK_DISTANCE_M = 4;

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

/** `ω_max = n_rueda · 2π/60`. */
export const omegaMax: RobotCalc = {
  id: 'omega-max',
  compute(robot) {
    const { wheelSpeed_rpm, omegaMax_radps } = chain(robot);
    return {
      latex: String.raw`\omega_{\max} = n_{rueda}\,\dfrac{2\pi}{60}`,
      substituted:
        String.raw`\omega_{\max} = ${formatRotation(wheelSpeed_rpm)}\ \text{rpm} \cdot \dfrac{2\pi}{60}` +
        String.raw` = ${formatRotation(omegaMax_radps)}\ \text{rad/s}`,
    };
  },
};

/** `v_max = ω_max · r`. */
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

/** `t = D / v_max`: the 4 m track at `v_max`. */
export const trackTime: RobotCalc = {
  id: 'track-time',
  compute(robot) {
    const { vMax_mps } = chain(robot);
    return {
      latex: String.raw`t = \dfrac{D}{v_{\max}}`,
      substituted:
        String.raw`t = \dfrac{${TRACK_DISTANCE_M}\ \text{m}}{${format(vMax_mps)}\ \text{m/s}}` +
        String.raw` = ${format(TRACK_DISTANCE_M / vMax_mps)}\ \text{s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelSpeed, omegaMax, vMax, trackTime];
