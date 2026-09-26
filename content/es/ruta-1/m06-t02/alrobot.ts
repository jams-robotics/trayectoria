import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-6.2 (docs/CURRICULUM.md § T-6.2): the robot's ω under the hook's P
 * commands, `ω = (ω_R − ω_L)·r / L`, and the largest Kp that does not saturate with
 * `ω_base = 15 rad/s`, `Kp ≤ (ω_max − ω_base) / |e|_max`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m06-t02/robot-omega" />` and `…/kp-max`.
 */

/** The hook's P case: Kp = 8, e = p = 0.4, ω_base = 15 rad/s. Constants of the text. */
const HOOK_KP = 8;
const HOOK_ERROR = 0.4;
const HOOK_OMEGA_BASE_RADPS = 15;
/** |e|_max: p ranges over [−1, 1]. */
const MAX_ERROR = 1;

/** Four significant figures for ω and ω_max (−1.365 rad/s, 20.94 rad/s), three for Kp (5.94). */
const OMEGA_SIGNIFICANT_FIGURES = 4;
const KP_SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, L = 0.15 m, 6000 rpm, i = 30).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_DRIVE = {
  wheelRadius_m: 0.032,
  wheelBase_m: 0.15,
  speed_rpm: 6000,
  gearRatio: 30,
} as const;

interface Drive {
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
  readonly speed_rpm: number;
  readonly gearRatio: number;
}

/**
 * Wheels of the profile. All four fields are required in a mobile profile; an arm profile has no
 * wheels and takes the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  if (robot.mobile === undefined) return REFERENCE_DRIVE;
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    wheelBase_m: robot.mobile.wheelBase_m,
    speed_rpm: robot.mobile.maxMotorSpeed_rpm,
    gearRatio: robot.mobile.gearRatio,
  };
}

/** Drops float noise and trailing zeros: 3.2, 18.2, 11.8, 15. */
function plain(value: number): string {
  return String(Number(value.toPrecision(12)));
}

/** ω_L = ω_base + u, ω_R = ω_base − u, with u = Kp·e from the hook. */
function hookCommands(): { omegaL_radps: number; omegaR_radps: number } {
  const u_radps = HOOK_KP * HOOK_ERROR;
  return {
    omegaL_radps: HOOK_OMEGA_BASE_RADPS + u_radps,
    omegaR_radps: HOOK_OMEGA_BASE_RADPS - u_radps,
  };
}

/** `ω = (ω_R − ω_L)·r / L`: the robot's angular velocity under the hook's commands. */
export const robotOmega: RobotCalc = {
  id: 'robot-omega',
  compute(robot) {
    const { wheelRadius_m, wheelBase_m } = drive(robot);
    const { omegaL_radps, omegaR_radps } = hookCommands();
    const omega_radps = ((omegaR_radps - omegaL_radps) * wheelRadius_m) / wheelBase_m;
    return {
      latex: String.raw`\omega = \dfrac{(\omega_R - \omega_L)\,r}{L}`,
      substituted:
        String.raw`\omega = \dfrac{(${plain(omegaR_radps)}\ \text{rad/s} - ${plain(omegaL_radps)}\ \text{rad/s})` +
        String.raw` \cdot ${wheelRadius_m}\ \text{m}}{${wheelBase_m}\ \text{m}}` +
        String.raw` = ${omega_radps.toPrecision(OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s}`,
    };
  },
};

/** `Kp ≤ (ω_max − ω_base) / |e|_max`, with `ω_max = n · 2π/60 / i` and `ω_base = 15 rad/s`. */
export const kpMax: RobotCalc = {
  id: 'kp-max',
  compute(robot) {
    const { speed_rpm, gearRatio } = drive(robot);
    const omegaMax_radps = (speed_rpm * RPM_TO_RADPS) / gearRatio;
    const kp = (omegaMax_radps - HOOK_OMEGA_BASE_RADPS) / MAX_ERROR;
    return {
      latex: String.raw`K_p \le \dfrac{\omega_{max} - \omega_{base}}{|e|_{max}}`,
      substituted:
        String.raw`K_p \le \dfrac{${omegaMax_radps.toPrecision(OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s}` +
        String.raw` - ${HOOK_OMEGA_BASE_RADPS}\ \text{rad/s}}{${MAX_ERROR}}` +
        String.raw` = ${kp.toPrecision(KP_SIGNIFICANT_FIGURES)}\ \text{rad/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [robotOmega, kpMax];
