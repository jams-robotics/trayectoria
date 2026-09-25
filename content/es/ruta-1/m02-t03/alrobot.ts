import type { RobotSpec } from '@trayectoria/robot-spec';
import { G_MPS2 } from '@trayectoria/sim-core';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-2.3 (docs/CURRICULUM.md § T-2.3): the torque that reaches each wheel of
 * «Mi robot», `τ_rueda = τ_motor · i · η`, the traction it pushes, `F_rueda = τ_rueda / r`, and the
 * friction limit of T-2.2, `f_max = μ_s · β · m · g`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m02-t03/wheel-torque" />`, `…/wheel-force` and `…/max-friction`.
 */

/** Three significant figures, keeping trailing zeros: 0.216 N·m, 6.75 N, 3.18 N. */
const SIGNIFICANT_FIGURES = 3;

/**
 * Wheel rubber with a caster wheel, constants of the text (T-2.2 and § T-2.3): μ_s = 0.6 and
 * β = 0.6 of the weight on the driven wheels.
 */
const MU_S = 0.6;
const DRIVEN_WEIGHT_FRACTION = 0.6;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, i = 30, m = 0.9 kg,
 * τ_bloqueo = 0.012 N·m, η = 0.6). `content` takes robot-spec for its types only (#246), so the
 * numbers are here.
 */
const REFERENCE_MOTOR = { motorTorque_Nm: 0.012, efficiency: 0.6 } as const;
const REFERENCE_DRIVE = { gearRatio: 30, wheelRadius_m: 0.032, mass_kg: 0.9 } as const;

interface Drive {
  readonly motorTorque_Nm: number;
  readonly efficiency: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly mass_kg: number;
}

/**
 * Motor, reduction, wheel and mass of the profile. `motor` is optional in RobotSpec: a profile
 * without it takes the reference stall torque and efficiency (#299); an arm profile has no wheels
 * and takes the whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  const { mobile } = robot;
  if (mobile === undefined) return { ...REFERENCE_MOTOR, ...REFERENCE_DRIVE };
  const motor =
    mobile.motor === undefined
      ? REFERENCE_MOTOR
      : { motorTorque_Nm: mobile.motor.stallTorque_Nm, efficiency: mobile.motor.efficiency };
  return {
    ...motor,
    gearRatio: mobile.gearRatio,
    wheelRadius_m: mobile.wheelRadius_m,
    mass_kg: mobile.mass_kg,
  };
}

/** `τ_rueda = τ_motor · i · η`. */
function wheelTorqueOf({ motorTorque_Nm, gearRatio, efficiency }: Drive): number {
  return motorTorque_Nm * gearRatio * efficiency;
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

const NEWTON_METRE = String.raw`\ \text{N}\cdot\text{m}`;

/** `τ_rueda = τ_motor · i · η`: the stall torque of the motor, through the reduction. */
export const wheelTorque: RobotCalc = {
  id: 'wheel-torque',
  compute(robot) {
    const current = drive(robot);
    const { motorTorque_Nm, gearRatio, efficiency } = current;
    return {
      latex: String.raw`\tau_{rueda} = \tau_{motor}\,i\,\eta`,
      substituted:
        String.raw`\tau_{rueda} = ${motorTorque_Nm}${NEWTON_METRE} \cdot ${gearRatio} \cdot ${efficiency}` +
        String.raw` = ${format(wheelTorqueOf(current))}${NEWTON_METRE}`,
    };
  },
};

/** `F_rueda = τ_rueda / r`: the traction of one wheel against the ground. */
export const wheelForce: RobotCalc = {
  id: 'wheel-force',
  compute(robot) {
    const current = drive(robot);
    const wheelTorque_Nm = wheelTorqueOf(current);
    const { wheelRadius_m } = current;
    return {
      latex: String.raw`F_{rueda} = \frac{\tau_{rueda}}{r}`,
      substituted:
        String.raw`F_{rueda} = \frac{${format(wheelTorque_Nm)}${NEWTON_METRE}}{${wheelRadius_m}\ \text{m}}` +
        String.raw` = ${format(wheelTorque_Nm / wheelRadius_m)}\ \text{N}`,
    };
  },
};

/** `f_max = μ_s · β · m · g`: the most traction the ground gives before the wheels slip. */
export const maxFriction: RobotCalc = {
  id: 'max-friction',
  compute(robot) {
    const { mass_kg } = drive(robot);
    const maxFriction_N = MU_S * DRIVEN_WEIGHT_FRACTION * mass_kg * G_MPS2;
    return {
      latex: String.raw`f_{max} = \mu_s\,\beta\,m\,g`,
      substituted:
        String.raw`f_{max} = ${MU_S} \cdot ${DRIVEN_WEIGHT_FRACTION} \cdot ${mass_kg}\ \text{kg}` +
        String.raw` \cdot ${G_MPS2}\ \text{m/s}^2 = ${format(maxFriction_N)}\ \text{N}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelTorque, wheelForce, maxFriction];
