import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-5.5 (docs/CURRICULUM.md § T-5.5, #394): the wheel commands of «Mi robot»
 * for each movement of the parking maneuver (turn in place at 4 rad/s, advance at 0.5 m/s) and
 * their check against `ω_max`. The time of the maneuver uses no profile field and is a static
 * `Formula` in the MDX. The MDX renders these with `<RobotFormula calc="ruta-1/m05-t05/turn-command" />`,
 * `…/forward-command` and `…/feasibility`.
 */

/** Speeds of the parking maneuver. */
const TURN_OMEGA_RADPS = 4;
const FORWARD_V_MPS = 0.5;

/** Four significant figures, as in the spec: 9.375, 15.63, 20.94 rad/s. */
const RADPS_SIGNIFICANT_FIGURES = 4;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

interface Drive {
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
  readonly speed_rpm: number;
  readonly gearRatio: number;
}

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, L = 0.15 m, 6000 rpm, i = 30).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_DRIVE: Drive = {
  wheelRadius_m: 0.032,
  wheelBase_m: 0.15,
  speed_rpm: 6000,
  gearRatio: 30,
};

/**
 * Drive of the profile. Every field used here is required in `mobile`; an arm profile has no
 * `mobile` and takes the whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
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

/** `ω_max = n · 2π/60 / i`: no-load wheel speed. */
function omegaMax_radps({ speed_rpm, gearRatio }: Drive): number {
  return (speed_rpm * RPM_TO_RADPS) / gearRatio;
}

/** Turn in place (`v = 0`): `ω_R = −ω_L = ωL/(2r)`. */
function turnWheel_radps({ wheelRadius_m, wheelBase_m }: Drive): number {
  return (TURN_OMEGA_RADPS * wheelBase_m) / (2 * wheelRadius_m);
}

/** Straight advance (`ω = 0`): `ω_L = ω_R = v/r`. */
function forwardWheel_radps({ wheelRadius_m }: Drive): number {
  return FORWARD_V_MPS / wheelRadius_m;
}

function formatRadps(value_radps: number): string {
  return value_radps.toPrecision(RADPS_SIGNIFICANT_FIGURES);
}

/** `ω_R = −ω_L = ωL/(2r)` for the turn in place at 4 rad/s. */
export const turnCommand: RobotCalc = {
  id: 'turn-command',
  compute(robot) {
    const current = drive(robot);
    return {
      latex: String.raw`\omega_R = -\omega_L = \dfrac{\omega L}{2r}`,
      substituted:
        String.raw`\omega_R = -\omega_L = \dfrac{${TURN_OMEGA_RADPS}\ \text{rad/s} \cdot ${current.wheelBase_m}\ \text{m}}` +
        String.raw`{2 \cdot ${current.wheelRadius_m}\ \text{m}}` +
        String.raw` = ${formatRadps(turnWheel_radps(current))}\ \text{rad/s}`,
    };
  },
};

/** `ω_L = ω_R = v/r` for the advance at 0.5 m/s. */
export const forwardCommand: RobotCalc = {
  id: 'forward-command',
  compute(robot) {
    const current = drive(robot);
    return {
      latex: String.raw`\omega_L = \omega_R = \dfrac{v}{r}`,
      substituted:
        String.raw`\omega_L = \omega_R = \dfrac{${FORWARD_V_MPS}\ \text{m/s}}{${current.wheelRadius_m}\ \text{m}}` +
        String.raw` = ${formatRadps(forwardWheel_radps(current))}\ \text{rad/s}`,
    };
  },
};

/** `max(|ω_L|, |ω_R|) ≤ ω_max` over both movements: whether the maneuver is realizable. */
export const feasibility: RobotCalc = {
  id: 'feasibility',
  compute(robot) {
    const current = drive(robot);
    const turn_radps = turnWheel_radps(current);
    const forward_radps = forwardWheel_radps(current);
    const peak_radps = Math.max(turn_radps, forward_radps);
    const limit_radps = omegaMax_radps(current);
    const limitText = String.raw`${formatRadps(limit_radps)}\ \text{rad/s}`;
    return {
      latex: String.raw`\max(|\omega_L|,|\omega_R|) \le \omega_{max}`,
      substituted:
        String.raw`\max(${formatRadps(turn_radps)},\ ${formatRadps(forward_radps)})\ \text{rad/s}` +
        String.raw` = ${formatRadps(peak_radps)}\ \text{rad/s}` +
        (peak_radps <= limit_radps
          ? String.raw` \le ${limitText}\ \Rightarrow\ \text{realizable}`
          : String.raw` > ${limitText}\ \Rightarrow\ \text{no realizable}`),
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [turnCommand, forwardCommand, feasibility];
