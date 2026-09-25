import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-4.4 (docs/CURRICULUM.md § T-4.4): `τ_rueda` from the gear ratio `i` of
 * «Mi robot», and the robot speed `v` with a different ratio, `i = 25`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m04-t04/wheel-torque" />` and `…/speed-other-ratio`.
 */

/** Three significant figures: 0.216 N·m and 0.804 m/s in the golden values. */
const SIGNIFICANT_FIGURES = 3;

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/** The different ratio of the spec for the speed calc. */
const OTHER_GEAR_RATIO = 25;

/**
 * Drive of the reference robot (docs/CURRICULUM.md, header: r = 0.032 m, 6000 rpm, i = 30,
 * τ_bloqueo = 0.012 N·m, η = 0.6). `content` takes robot-spec for its types only (#246), so the
 * numbers are written here.
 */
const REFERENCE_DRIVE = { wheelRadius_m: 0.032, speed_rpm: 6000, gearRatio: 30 } as const;
const REFERENCE_MOTOR = { stallTorque_Nm: 0.012, efficiency: 0.6 } as const;

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/**
 * Wheel radius, motor speed and gear ratio of the profile, all required in the mobile spec. An
 * arm profile has no wheels, so it falls back to the reference robot (CONTENT-STANDARDS §2.5).
 */
function drive(robot: RobotSpec): { wheelRadius_m: number; speed_rpm: number; gearRatio: number } {
  if (robot.mobile === undefined) return REFERENCE_DRIVE;
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    speed_rpm: robot.mobile.maxMotorSpeed_rpm,
    gearRatio: robot.mobile.gearRatio,
  };
}

/** Motor torque and efficiency of the profile; `motor` is optional, so it falls back (#301). */
function motor(robot: RobotSpec): { stallTorque_Nm: number; efficiency: number } {
  const profileMotor = robot.mobile?.motor;
  if (profileMotor === undefined) return REFERENCE_MOTOR;
  return { stallTorque_Nm: profileMotor.stallTorque_Nm, efficiency: profileMotor.efficiency };
}

/** `τ_rueda = τ_motor · i · η`. */
export const wheelTorque: RobotCalc = {
  id: 'wheel-torque',
  compute(robot) {
    const { gearRatio } = drive(robot);
    const { stallTorque_Nm, efficiency } = motor(robot);
    return {
      latex: String.raw`\tau_{\text{rueda}} = \tau_{\text{motor}}\,i\,\eta`,
      substituted:
        String.raw`\tau_{\text{rueda}} = ${stallTorque_Nm}\ \text{N}\cdot\text{m} \cdot ${gearRatio} \cdot ${efficiency}` +
        String.raw` = ${format(stallTorque_Nm * gearRatio * efficiency)}\ \text{N}\cdot\text{m}`,
    };
  },
};

/** `v = n_motor / i · 2π/60 · r` with `i = 25` instead of the ratio of the profile. */
export const speedOtherRatio: RobotCalc = {
  id: 'speed-other-ratio',
  compute(robot) {
    const { wheelRadius_m, speed_rpm } = drive(robot);
    const v_mps = (speed_rpm / OTHER_GEAR_RATIO) * RPM_TO_RADPS * wheelRadius_m;
    return {
      latex: String.raw`v = \dfrac{n_{\text{motor}}}{i} \cdot \dfrac{2\pi}{60} \cdot r`,
      substituted:
        String.raw`v = \dfrac{${speed_rpm}}{${OTHER_GEAR_RATIO}} \cdot \dfrac{2\pi}{60} \cdot ${wheelRadius_m}` +
        String.raw` = ${format(v_mps)}\ \text{m/s}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelTorque, speedOtherRatio];
