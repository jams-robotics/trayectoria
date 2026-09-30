import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T1-2.4 (docs/CURRICULUM.md § T1-2.4): the stall torque of the motor of
 * «Mi robot» through its reduction, `τ_rueda = τ_s · i · η_caja`, and the traction each wheel
 * pushes with it, `F_rueda = τ_rueda / r`, both with the shaft stopped (#609). The friction limit
 * is cited from T1-2.2, not recomputed (#565). The MDX renders them with
 * `<RobotFormula calc="ruta-1/m02-t04/wheel-torque" />` and `…/wheel-force`.
 */

/** Three significant figures, keeping trailing zeros: 0.216 N·m, 6.75 N. */
const SIGNIFICANT_FIGURES = 3;

/**
 * Reference robot (docs/ROBOT-SPEC.md §3: r = 0.032 m, i = 30, τ_s = 0.012 N·m, η_caja = 0.6).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_MOTOR = { stallTorque_Nm: 0.012, gearboxEfficiency: 0.6 } as const;
const REFERENCE_DRIVE = { gearRatio: 30, wheelRadius_m: 0.032 } as const;

interface Drive {
  readonly stallTorque_Nm: number;
  readonly gearboxEfficiency: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
}

/**
 * Motor, reduction and wheel of the profile. `motor` is optional in RobotSpec: a profile without
 * it takes the reference stall torque and gearbox efficiency (#299); an arm profile has no wheels
 * and takes the whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  const { mobile } = robot;
  if (mobile === undefined) return { ...REFERENCE_MOTOR, ...REFERENCE_DRIVE };
  const motor =
    mobile.motor === undefined
      ? REFERENCE_MOTOR
      : { stallTorque_Nm: mobile.motor.stallTorque_Nm, gearboxEfficiency: mobile.motor.efficiency };
  return { ...motor, gearRatio: mobile.gearRatio, wheelRadius_m: mobile.wheelRadius_m };
}

/** `τ_rueda = τ_s · i · η_caja`. */
function wheelTorqueOf({ stallTorque_Nm, gearRatio, gearboxEfficiency }: Drive): number {
  return stallTorque_Nm * gearRatio * gearboxEfficiency;
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

const NEWTON_METRE = String.raw`\ \text{N}\cdot\text{m}`;

/** `τ_rueda = τ_s · i · η_caja`: the stall torque of the motor, through the reduction. */
export const wheelTorque: RobotCalc = {
  id: 'wheel-torque',
  compute(robot) {
    const current = drive(robot);
    const { stallTorque_Nm, gearRatio, gearboxEfficiency } = current;
    return {
      latex: String.raw`\tau_{rueda} = \tau_s\,i\,\eta_{caja}`,
      substituted:
        String.raw`\tau_{rueda} = ${stallTorque_Nm}${NEWTON_METRE} \cdot ${gearRatio} \cdot ${gearboxEfficiency}` +
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

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelTorque, wheelForce];
