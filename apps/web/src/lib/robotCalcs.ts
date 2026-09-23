import { ROBOT_CALCS as TOPIC_ROBOT_CALCS } from '@trayectoria/content';
import type { RobotCalc } from '@trayectoria/content';
import { referenceRobot } from '@trayectoria/widgets/MyRobotWidget';

/**
 * Registry key → «Al robot» calc that `RobotFormula` resolves (#243, decision 3). The island
 * receives only the key: a calc is a function, and Astro serializes island props to JSON.
 *
 * Built from the map of `@trayectoria/content` (keys `<topicId>/<calcId>`) plus one demo calc
 * under `demo/omega-rueda`, the `/dev/tema` fixture, like `demo/track-time` in `exercises.ts`.
 */
export const DEMO_ROBOT_CALC_KEY = 'demo/omega-rueda';

const RPM_TO_RADPS = (2 * Math.PI) / 60;
/** Four significant figures: 628.3 and 20.94 in the golden values of F6-01. */
const SIGNIFICANT_FIGURES = 4;

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/**
 * `ω_rueda = ω_motor / i` with the motor speed and the gear ratio of «Mi robot». An arm profile
 * has no wheels, so it falls back to the reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
const demoWheelSpeed: RobotCalc = {
  id: 'omega-rueda',
  compute(robot) {
    const mobile = robot.mobile ?? referenceRobot().mobile;
    if (mobile === undefined) throw new Error('the reference robot has no mobile spec');
    const { maxMotorSpeed_rpm: motorSpeed_rpm, gearRatio } = mobile;
    const omegaMotor_radps = motorSpeed_rpm * RPM_TO_RADPS;
    const omegaWheel_radps = omegaMotor_radps / gearRatio;
    return {
      latex: String.raw`\omega_{\text{rueda}} = \dfrac{\omega_{\text{motor}}}{i}`,
      substituted:
        String.raw`\omega_{\text{rueda}} = \dfrac{${motorSpeed_rpm} \cdot 2\pi / 60}{${gearRatio}}` +
        String.raw` = \dfrac{${format(omegaMotor_radps)}\ \text{rad/s}}{${gearRatio}}` +
        String.raw` = ${format(omegaWheel_radps)}\ \text{rad/s}`,
    };
  },
};

const ROBOT_CALCS = new Map<string, RobotCalc>([
  [DEMO_ROBOT_CALC_KEY, demoWheelSpeed],
  ...TOPIC_ROBOT_CALCS,
]);

/** Valid keys of the registry, for the build error of `RobotFormula.astro`. */
export function robotCalcKeys(): readonly string[] {
  return [...ROBOT_CALCS.keys()];
}

/** Resolves a key to its calc, or `undefined` if no topic declares it. */
export function findRobotCalc(key: string): RobotCalc | undefined {
  return ROBOT_CALCS.get(key);
}
