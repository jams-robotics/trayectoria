import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T2-1.1 (docs/CURRICULUM.md § T2-1.1, #394): v, ω and R of «Mi robot» for the
 * wheels of the hook (ω_L = 15 rad/s, ω_R = 20 rad/s), and ω of a spin in place with ±10 rad/s,
 * as in e3. The MDX renders them with `<RobotFormula calc="ruta-2/m01-t01/linear-velocity" />`,
 * `…/angular-velocity`, `…/turn-radius` and `…/spin-angular-velocity`.
 */

/**
 * Significant figures of each value, those of its golden value, padding zeros kept
 * (docs/CONTENT-STANDARDS.md §2.5, #653): 0.56 m/s, 1.067 rad/s (and 4.267 rad/s), 0.525 m.
 */
const SPEED_SIGNIFICANT_FIGURES = 2;
const OMEGA_SIGNIFICANT_FIGURES = 4;
const RADIUS_SIGNIFICANT_FIGURES = 3;

/** Wheel commands of the hook and of the spin in place (#394). */
const HOOK_OMEGA_L_RADPS = 15;
const HOOK_OMEGA_R_RADPS = 20;
const SPIN_OMEGA_R_RADPS = 10;
const SPIN_OMEGA_L_RADPS = -SPIN_OMEGA_R_RADPS;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, L = 0.15 m). `content` takes
 * robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_WHEELS = { wheelRadius_m: 0.032, wheelBase_m: 0.15 } as const;

interface Wheels {
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
}

/**
 * Wheel radius and wheel base of the profile, both required in RobotSpec's mobile block; an arm
 * profile has no wheels and takes the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function wheels(robot: RobotSpec): Wheels {
  if (robot.mobile === undefined) return REFERENCE_WHEELS;
  return { wheelRadius_m: robot.mobile.wheelRadius_m, wheelBase_m: robot.mobile.wheelBase_m };
}

/** `v = (ω_R + ω_L)·r / 2`. */
function linearVelocity_mps({ wheelRadius_m }: Wheels): number {
  return ((HOOK_OMEGA_R_RADPS + HOOK_OMEGA_L_RADPS) * wheelRadius_m) / 2;
}

/** `ω = (ω_R − ω_L)·r / L`. */
function omega_radps(
  { wheelRadius_m, wheelBase_m }: Wheels,
  omegaL_radps: number,
  omegaR_radps: number,
): number {
  return ((omegaR_radps - omegaL_radps) * wheelRadius_m) / wheelBase_m;
}

/** A value with more integer digits than figures is written whole. */
function format(value: number, significantFigures: number): string {
  return Math.abs(value) < 10 ** significantFigures
    ? value.toPrecision(significantFigures)
    : Math.round(value).toString();
}

/** A wheel command inside the substituted formula: negative values go in parentheses. */
function formatCommand(omega: number): string {
  return omega < 0 ? `(${omega})` : String(omega);
}

const OMEGA_LATEX = String.raw`\omega = \dfrac{(\omega_R - \omega_L)\,r}{L}`;

function omegaSubstituted(robot: Wheels, omegaL_radps: number, omegaR_radps: number): string {
  const { wheelRadius_m, wheelBase_m } = robot;
  return (
    String.raw`\omega = \dfrac{(${formatCommand(omegaR_radps)} - ${formatCommand(omegaL_radps)})` +
    String.raw`\ \text{rad/s} \cdot ${wheelRadius_m}\ \text{m}}{${wheelBase_m}\ \text{m}}` +
    String.raw` = ${format(omega_radps(robot, omegaL_radps, omegaR_radps), OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s}`
  );
}

/** `v = (ω_R + ω_L)·r / 2` for the wheels of the hook. */
export const linearVelocity: RobotCalc = {
  id: 'linear-velocity',
  compute(robot) {
    const profile = wheels(robot);
    return {
      latex: String.raw`v = \dfrac{(\omega_R + \omega_L)\,r}{2}`,
      substituted:
        String.raw`v = \dfrac{(${HOOK_OMEGA_R_RADPS} + ${HOOK_OMEGA_L_RADPS})\ \text{rad/s}` +
        String.raw` \cdot ${profile.wheelRadius_m}\ \text{m}}{2}` +
        String.raw` = ${format(linearVelocity_mps(profile), SPEED_SIGNIFICANT_FIGURES)}\ \text{m/s}`,
    };
  },
};

/** `ω = (ω_R − ω_L)·r / L` for the wheels of the hook. */
export const angularVelocity: RobotCalc = {
  id: 'angular-velocity',
  compute(robot) {
    return {
      latex: OMEGA_LATEX,
      substituted: omegaSubstituted(wheels(robot), HOOK_OMEGA_L_RADPS, HOOK_OMEGA_R_RADPS),
    };
  },
};

/** `R = v / ω` for the wheels of the hook; positive, with the CIR on the left. */
export const turnRadius: RobotCalc = {
  id: 'turn-radius',
  compute(robot) {
    const profile = wheels(robot);
    const v_mps = linearVelocity_mps(profile);
    const omega = omega_radps(profile, HOOK_OMEGA_L_RADPS, HOOK_OMEGA_R_RADPS);
    return {
      latex: String.raw`R = \dfrac{v}{\omega}`,
      substituted:
        String.raw`R = \dfrac{${format(v_mps, SPEED_SIGNIFICANT_FIGURES)}\ \text{m/s}}` +
        String.raw`{${format(omega, OMEGA_SIGNIFICANT_FIGURES)}\ \text{rad/s}}` +
        String.raw` = ${format(v_mps / omega, RADIUS_SIGNIFICANT_FIGURES)}\ \text{m}`,
    };
  },
};

/** `ω = (ω_R − ω_L)·r / L` for a spin in place with ±10 rad/s. */
export const spinAngularVelocity: RobotCalc = {
  id: 'spin-angular-velocity',
  compute(robot) {
    return {
      latex: OMEGA_LATEX,
      substituted: omegaSubstituted(wheels(robot), SPIN_OMEGA_L_RADPS, SPIN_OMEGA_R_RADPS),
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [
  linearVelocity,
  angularVelocity,
  turnRadius,
  spinAngularVelocity,
];
