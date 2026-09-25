import type { RobotSpec } from '@trayectoria/robot-spec';
import { G_MPS2 } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-3.1 (docs/CURRICULUM.md § T-3.1, #300): the kinetic energy of «Mi robot»
 * at `v_max`, `E_k = ½·m·v_max²`, and the height it would climb by inertia, `h_max = v_max²/(2g)`.
 * They read only required fields of RobotSpec. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m03-t01/kinetic-energy" />` and `…/max-height`.
 */

/** Three significant figures, keeping trailing zeros: 0.670 m/s, 0.202 J, 0.0229 m. */
const SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30, m = 0.9 kg).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_ROBOT = {
  speed_rpm: 6000,
  gearRatio: 30,
  wheelRadius_m: 0.032,
  mass_kg: 0.9,
} as const;

interface Motion {
  readonly mass_kg: number;
  readonly vMax_mps: number;
}

/**
 * Mass and `v_max = ω_max · r` of the profile, with `ω_max = n · 2π/60 / i`. An arm profile has
 * no wheels and takes the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function motion(robot: RobotSpec): Motion {
  const { speed_rpm, gearRatio, wheelRadius_m, mass_kg } =
    robot.mobile === undefined
      ? REFERENCE_ROBOT
      : { ...robot.mobile, speed_rpm: robot.mobile.maxMotorSpeed_rpm };
  const omegaMax_radps = (speed_rpm * RPM_TO_RADPS) / gearRatio;
  return { mass_kg, vMax_mps: omegaMax_radps * wheelRadius_m };
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `E_k = ½·m·v_max²`: kinetic energy at top speed. */
export const kineticEnergy: RobotCalc = {
  id: 'kinetic-energy',
  compute(robot) {
    const { mass_kg, vMax_mps } = motion(robot);
    return {
      latex: String.raw`E_k = \tfrac12 m\,v_{\max}^2`,
      substituted:
        String.raw`E_k = \tfrac12 \cdot ${mass_kg}\ \text{kg} \cdot (${format(vMax_mps)}\ \text{m/s})^2` +
        String.raw` = ${format((mass_kg * vMax_mps ** 2) / 2)}\ \text{J}`,
    };
  },
};

/** `h_max = v_max² / (2g)`: height climbed by inertia from top speed, without friction. */
export const maxHeight: RobotCalc = {
  id: 'max-height',
  compute(robot) {
    const { vMax_mps } = motion(robot);
    return {
      latex: String.raw`h_{\max} = \dfrac{v_{\max}^2}{2g}`,
      substituted:
        String.raw`h_{\max} = \dfrac{(${format(vMax_mps)}\ \text{m/s})^2}{2 \cdot ${G_MPS2}\ \text{m/s}^2}` +
        String.raw` = ${format(vMax_mps ** 2 / (2 * G_MPS2))}\ \text{m}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [kineticEnergy, maxHeight];
