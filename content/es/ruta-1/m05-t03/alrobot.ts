import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-5.3 (docs/CURRICULUM.md § T-5.3): the wheel commands of «Mi robot» for the
 * command of the hook (v = 0.4 m/s, ω = 1.5 rad/s), their check against `ω_max`, and the faster
 * command v = 0.6 m/s, ω = 2 rad/s against `v_max = ω_max · r`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m05-t03/wheel-right" />`, `…/wheel-left`, `…/feasibility` and
 * `…/fast-command`.
 */

/** Command of the hook. */
const HOOK_V_MPS = 0.4;
const HOOK_OMEGA_RADPS = 1.5;

/** Faster command of «Al robot», which the reference robot cannot follow. */
const FAST_V_MPS = 0.6;
const FAST_OMEGA_RADPS = 2;

/** Angular velocities to the hundredth, as in the spec: 16.02, 8.98, 20.94 rad/s. */
const RADPS_DECIMALS = 2;

/** Three significant figures for linear speeds, keeping trailing zeros: 0.750, 0.670 m/s. */
const SPEED_SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

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

interface Drive {
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
  readonly speed_rpm: number;
  readonly gearRatio: number;
}

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

/** `v_L = v − ωL/2` and `v_R = v + ωL/2`. */
function wheelSpeeds(
  v_mps: number,
  omega_radps: number,
  wheelBase_m: number,
): { vL_mps: number; vR_mps: number } {
  const halfSpread_mps = (omega_radps * wheelBase_m) / 2;
  return { vL_mps: v_mps - halfSpread_mps, vR_mps: v_mps + halfSpread_mps };
}

/** Wheel angular velocities for the command of the hook. */
function hookWheels(robot: RobotSpec): { omegaL_radps: number; omegaR_radps: number } {
  const { wheelRadius_m, wheelBase_m } = drive(robot);
  const { vL_mps, vR_mps } = wheelSpeeds(HOOK_V_MPS, HOOK_OMEGA_RADPS, wheelBase_m);
  return { omegaL_radps: vL_mps / wheelRadius_m, omegaR_radps: vR_mps / wheelRadius_m };
}

function formatRadps(value_radps: number): string {
  return value_radps.toFixed(RADPS_DECIMALS);
}

function formatSpeed(value_mps: number): string {
  return value_mps.toPrecision(SPEED_SIGNIFICANT_FIGURES);
}

/** The verdict after a comparison: `≤ … ⇒ realizable` or `> … ⇒ no realizable`. */
function verdict(value: number, limit: number, limitText: string): string {
  return value <= limit
    ? String.raw` \le ${limitText}\ \Rightarrow\ \text{realizable}`
    : String.raw` > ${limitText}\ \Rightarrow\ \text{no realizable}`;
}

/** `v ± ωL/2` over `r`, with the command of the hook. */
function wheelFraction(sign: '+' | '-', robot: RobotSpec): string {
  const { wheelRadius_m, wheelBase_m } = drive(robot);
  return (
    String.raw`\dfrac{${HOOK_V_MPS}\ \text{m/s} ${sign} \frac{${HOOK_OMEGA_RADPS}\ \text{rad/s} \cdot ` +
    String.raw`${wheelBase_m}\ \text{m}}{2}}{${wheelRadius_m}\ \text{m}}`
  );
}

/** `ω_R = (v + ωL/2) / r`. */
export const wheelRight: RobotCalc = {
  id: 'wheel-right',
  compute(robot) {
    return {
      latex: String.raw`\omega_R = \dfrac{v + \frac{\omega L}{2}}{r}`,
      substituted:
        String.raw`\omega_R = ${wheelFraction('+', robot)}` +
        String.raw` = ${formatRadps(hookWheels(robot).omegaR_radps)}\ \text{rad/s}`,
    };
  },
};

/** `ω_L = (v − ωL/2) / r`. */
export const wheelLeft: RobotCalc = {
  id: 'wheel-left',
  compute(robot) {
    return {
      latex: String.raw`\omega_L = \dfrac{v - \frac{\omega L}{2}}{r}`,
      substituted:
        String.raw`\omega_L = ${wheelFraction('-', robot)}` +
        String.raw` = ${formatRadps(hookWheels(robot).omegaL_radps)}\ \text{rad/s}`,
    };
  },
};

/** `max(|ω_L|, |ω_R|) ≤ ω_max`: whether the command of the hook is realizable. */
export const feasibility: RobotCalc = {
  id: 'feasibility',
  compute(robot) {
    const { omegaL_radps, omegaR_radps } = hookWheels(robot);
    const peak_radps = Math.max(Math.abs(omegaL_radps), Math.abs(omegaR_radps));
    const limit_radps = omegaMax_radps(drive(robot));
    return {
      latex: String.raw`\max(|\omega_L|,|\omega_R|) \le \omega_{max}`,
      substituted:
        String.raw`\max(${formatRadps(Math.abs(omegaL_radps))},\ ${formatRadps(Math.abs(omegaR_radps))})\ \text{rad/s}` +
        String.raw` = ${formatRadps(peak_radps)}\ \text{rad/s}` +
        verdict(peak_radps, limit_radps, String.raw`${formatRadps(limit_radps)}\ \text{rad/s}`),
    };
  },
};

/** `v_R = v + ωL/2` for v = 0.6 m/s, ω = 2 rad/s, against `v_max = ω_max · r`. */
export const fastCommand: RobotCalc = {
  id: 'fast-command',
  compute(robot) {
    const current = drive(robot);
    const { vR_mps } = wheelSpeeds(FAST_V_MPS, FAST_OMEGA_RADPS, current.wheelBase_m);
    const vMax_mps = omegaMax_radps(current) * current.wheelRadius_m;
    return {
      latex: String.raw`v_R = v + \frac{\omega L}{2} \le v_{max} = \omega_{max}\, r`,
      substituted:
        String.raw`v_R = ${FAST_V_MPS}\ \text{m/s} + \frac{${FAST_OMEGA_RADPS}\ \text{rad/s} \cdot ${current.wheelBase_m}\ \text{m}}{2}` +
        String.raw` = ${formatSpeed(vR_mps)}\ \text{m/s}` +
        verdict(vR_mps, vMax_mps, String.raw`${formatSpeed(vMax_mps)}\ \text{m/s}`),
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelRight, wheelLeft, feasibility, fastCommand];
