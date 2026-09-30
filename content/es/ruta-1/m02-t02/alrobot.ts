import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calc of T1-2.2 (docs/CURRICULUM.md § T1-2.2, #609, #559): the acceleration the motor
 * of «Mi robot» can ask for at full voltage from rest, with the stall force of both wheels,
 * `a_motor = 2 F_rueda / m`, to compare with the traction limit `a_max = μs·g·β`. `F_rueda` is a
 * datum of the profile: the calc obtains it as `τ_s i η_caja / r` without showing the torque,
 * which T1-2.4 teaches. `a_max` uses constants of the text (μs = 0.6, β = 0.6), so the MDX writes
 * it as a static `Formula`; the simulator ramp is the one of T1-1.2, cited in the text (#565). The
 * MDX renders the calc with `<RobotFormula calc="ruta-1/m02-t02/motor-acceleration" />`.
 */

/** Three significant figures, keeping trailing zeros: 15.0 m/s². */
const SIGNIFICANT_FIGURES = 3;

/** Four significant figures for the datum `F_rueda` (6.75 N), trailing zeros dropped. */
const FORCE_SIGNIFICANT_FIGURES = 4;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, i = 30, m = 0.9 kg, τ_s = 0.012 N·m,
 * η_caja = 0.6). `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_MOTOR = { stallTorque_Nm: 0.012, gearboxEfficiency: 0.6 } as const;
const REFERENCE_DRIVE = { gearRatio: 30, wheelRadius_m: 0.032, mass_kg: 0.9 } as const;

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

/** Stall force of one wheel on the ground, `F_rueda = τ_s i η_caja / r`: the datum. */
function wheelForce_N({ stallTorque_Nm, gearRatio, gearboxEfficiency, wheelRadius_m }: Drive): number {
  return (stallTorque_Nm * gearRatio * gearboxEfficiency) / wheelRadius_m;
}

/** `a_motor = 2 F_rueda / m`: what the stall force of both wheels would give from rest. */
export const motorAcceleration: RobotCalc = {
  id: 'motor-acceleration',
  compute(robot) {
    const profile = drive(robot);
    const force_N = Number(wheelForce_N(profile).toPrecision(FORCE_SIGNIFICANT_FIGURES));
    const motorAccel_mps2 = (2 * wheelForce_N(profile)) / profile.mass_kg;
    return {
      latex: String.raw`a_{motor} = \dfrac{2\,F_{rueda}}{m}`,
      substituted:
        String.raw`a_{motor} = \dfrac{2 \cdot ${force_N}\ \text{N}}{${profile.mass_kg}\ \text{kg}}` +
        String.raw` = ${motorAccel_mps2.toPrecision(SIGNIFICANT_FIGURES)}\ \text{m/s}^2`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [motorAcceleration];
