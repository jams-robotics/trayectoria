import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-2.2 (docs/CURRICULUM.md § T-2.2, #609): the acceleration the motor of
 * «Mi robot» can ask for at full voltage from rest, with its stall torque through the reduction on
 * both wheels, `a_motor = 2 τ_s i η_caja / (r m)`, to compare with the traction limit
 * `a_max = μs·g·β`; and the ramp the simulator applies to the wheels, `a = α · r`, to check it
 * stays below that limit. `a_max` uses constants of the text (μs = 0.6, β = 0.6), so the MDX writes
 * it as a static `Formula`; the profile calcs render with
 * `<RobotFormula calc="ruta-1/m02-t02/motor-acceleration" />` and `…/acceleration`.
 */

/** Three significant figures, keeping trailing zeros: 15.0 m/s², 1.28 m/s², 2.00 m/s². */
const SIGNIFICANT_FIGURES = 3;

/** Four significant figures for α, as in T-1.2. */
const ALPHA_SIGNIFICANT_FIGURES = 4;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, i = 30, m = 0.9 kg, τ_s = 0.012 N·m,
 * η_caja = 0.6; § T-2.2 and #288: α = 40 rad/s²). `content` takes robot-spec for its types only
 * (#246), so the numbers are here.
 */
const REFERENCE_ALPHA_RADPS2 = 40;
const REFERENCE_MOTOR = { stallTorque_Nm: 0.012, gearboxEfficiency: 0.6 } as const;
const REFERENCE_DRIVE = { gearRatio: 30, wheelRadius_m: 0.032, mass_kg: 0.9 } as const;

interface Wheel {
  readonly wheelRadius_m: number;
  readonly alpha_radps2: number;
}

/**
 * Wheel radius and angular acceleration of the profile. `maxAccel_radps2` is optional in
 * RobotSpec: a profile without it takes the reference α; an arm profile has no wheels and takes
 * the reference robot (docs/CONTENT-STANDARDS.md §2.5, decision of #288).
 */
function wheel(robot: RobotSpec): Wheel {
  if (robot.mobile === undefined) {
    return { wheelRadius_m: REFERENCE_DRIVE.wheelRadius_m, alpha_radps2: REFERENCE_ALPHA_RADPS2 };
  }
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    alpha_radps2: robot.mobile.maxAccel_radps2 ?? REFERENCE_ALPHA_RADPS2,
  };
}

interface Drive {
  readonly stallTorque_Nm: number;
  readonly gearboxEfficiency: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly mass_kg: number;
}

/**
 * Motor, reduction, wheel and mass of the profile. `motor` is optional in RobotSpec: a profile
 * without it takes the reference stall torque and gearbox efficiency (#609); an arm profile has no
 * wheels and takes the whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  const { mobile } = robot;
  if (mobile === undefined) return { ...REFERENCE_MOTOR, ...REFERENCE_DRIVE };
  const motor =
    mobile.motor === undefined
      ? REFERENCE_MOTOR
      : { stallTorque_Nm: mobile.motor.stallTorque_Nm, gearboxEfficiency: mobile.motor.efficiency };
  return {
    ...motor,
    gearRatio: mobile.gearRatio,
    wheelRadius_m: mobile.wheelRadius_m,
    mass_kg: mobile.mass_kg,
  };
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

function formatAlpha(alpha_radps2: number): string {
  return String(Number(alpha_radps2.toPrecision(ALPHA_SIGNIFICANT_FIGURES)));
}

const NEWTON_METRE = String.raw`\ \text{N}\cdot\text{m}`;

/** `a_motor = 2 τ_s i η_caja / (r m)`: what the stall torque of both wheels would give from rest. */
export const motorAcceleration: RobotCalc = {
  id: 'motor-acceleration',
  compute(robot) {
    const { stallTorque_Nm, gearboxEfficiency, gearRatio, wheelRadius_m, mass_kg } = drive(robot);
    const motorAccel_mps2 =
      (2 * stallTorque_Nm * gearRatio * gearboxEfficiency) / (wheelRadius_m * mass_kg);
    return {
      latex: String.raw`a_{motor} = \dfrac{2\,\tau_s\,i\,\eta_{caja}}{r\,m}`,
      substituted:
        String.raw`a_{motor} = \dfrac{2 \cdot ${stallTorque_Nm}${NEWTON_METRE} \cdot ${gearRatio} \cdot ${gearboxEfficiency}}` +
        String.raw`{${wheelRadius_m}\ \text{m} \cdot ${mass_kg}\ \text{kg}} = ${format(motorAccel_mps2)}\ \text{m/s}^2`,
    };
  },
};

/** `a = α · r`: the ramp the simulator applies to the wheels, without slipping. */
export const acceleration: RobotCalc = {
  id: 'acceleration',
  compute(robot) {
    const { wheelRadius_m, alpha_radps2 } = wheel(robot);
    const a_mps2 = alpha_radps2 * wheelRadius_m;
    return {
      latex: String.raw`a = \alpha \cdot r`,
      substituted:
        String.raw`a = ${formatAlpha(alpha_radps2)}\ \text{rad/s}^2 \cdot ${wheelRadius_m}\ \text{m}` +
        String.raw` = ${format(a_mps2)}\ \text{m/s}^2`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [motorAcceleration, acceleration];
