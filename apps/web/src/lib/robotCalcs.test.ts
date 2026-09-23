import { ROBOT_CALCS } from '@trayectoria/content';
import { referenceRobot } from '@trayectoria/widgets/MyRobotWidget';
import type { RobotSpec } from '@trayectoria/widgets/MyRobotWidget';
import { describe, expect, it } from 'vitest';

import { DEMO_ROBOT_CALC_KEY, findRobotCalc, robotCalcKeys } from './robotCalcs';

/** The reference robot with another gear ratio, as if the learner had saved it in «Mi robot». */
function withGearRatio(gearRatio: number): RobotSpec {
  const robot = referenceRobot();
  if (robot.mobile === undefined) throw new Error('the reference robot is mobile');
  return { ...robot, mobile: { ...robot.mobile, gearRatio } };
}

describe('robot calc registry', () => {
  it('holds the demo calc and every topic calc of @trayectoria/content', () => {
    expect(robotCalcKeys()).toEqual([DEMO_ROBOT_CALC_KEY, ...ROBOT_CALCS.keys()]);
  });

  it('returns undefined for a key no topic declares', () => {
    expect(findRobotCalc('ruta-9/m99-t99/omega-rueda')).toBeUndefined();
  });
});

describe('demo calc omega-rueda', () => {
  const calc = findRobotCalc(DEMO_ROBOT_CALC_KEY);

  it('is filed under demo/omega-rueda', () => {
    expect(DEMO_ROBOT_CALC_KEY).toBe('demo/omega-rueda');
    expect(calc?.id).toBe('omega-rueda');
  });

  // Golden values of F6-01: ω_motor = 6000·2π/60 = 628.3 rad/s; ω_rueda = 628.3/30 = 20.94 rad/s.
  it('substitutes the reference robot: 628.3 rad/s at the motor, 20.94 rad/s at the wheel', () => {
    const formula = calc?.compute(referenceRobot());

    expect(formula?.latex).toBe(
      String.raw`\omega_{\text{rueda}} = \dfrac{\omega_{\text{motor}}}{i}`,
    );
    expect(formula?.substituted).toBe(
      String.raw`\omega_{\text{rueda}} = \dfrac{6000 \cdot 2\pi / 60}{30} = \dfrac{628.3\ \text{rad/s}}{30} = 20.94\ \text{rad/s}`,
    );
  });

  it('follows the gear ratio of «Mi robot»: 628.3/15 = 41.89 rad/s', () => {
    expect(calc?.compute(withGearRatio(15)).substituted).toContain(
      String.raw`= 41.89\ \text{rad/s}`,
    );
  });
});
