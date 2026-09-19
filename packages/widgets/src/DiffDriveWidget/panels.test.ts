import { describe, expect, it } from 'vitest';
import { degToRad } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { defaultRobot, mobileOf } from './compute';
import {
  applyCalibration,
  applyTheta,
  applyTwist,
  applyWheel,
  calibrationParams,
  thetaParam,
  twistParams,
  wheelParams,
} from './panels';
import { calibrationOf } from './odometry';
import type { Pose } from './compute';

const SPEC = mobileOf(defaultRobot());
/** The translator of the tests: the key itself, so a label is checked without the locale file. */
const t: Translate = (key: string) => key;

describe('DiffDriveWidget panels (F2-09a)', () => {
  it('los sliders del modo directo llegan a ±ω_max del perfil (#92, decisión 4)', () => {
    const [left, right] = wheelParams({ omegaL_radps: 15, omegaR_radps: 20 }, SPEC, t);
    expect(left?.max).toBe(20.9);
    expect(left?.min).toBe(-20.9);
    expect(left?.step).toBe(0.1);
    expect(right?.value).toBe(20);
  });

  it('los sliders del modo inverso llegan a ±v_max y a ±5 rad/s (#92, decisión 4)', () => {
    const [v, omega] = twistParams({ v_mps: 0.4, omega_radps: 1.5 }, SPEC, t);
    expect(v?.max).toBe(0.67);
    expect(v?.step).toBe(0.01);
    expect(omega?.max).toBe(5);
    expect(omega?.step).toBe(0.05);
  });

  it('el slider de θ recorre [−180°, 180°] y muestra la orientación en grados', () => {
    const pose: Pose = { x_m: 0, y_m: 0, theta_rad: degToRad(90) };
    const [theta] = thetaParam(pose, t);
    expect(theta?.min).toBe(-180);
    expect(theta?.max).toBe(180);
    expect(theta?.value).toBe(90);
    expect(applyTheta(pose, -90).theta_rad).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('cada cambio toca solo su valor y una clave desconocida no cambia nada', () => {
    const command = { omegaL_radps: 15, omegaR_radps: 20 };
    expect(applyWheel(command, 'omegaL', 5)).toEqual({ omegaL_radps: 5, omegaR_radps: 20 });
    expect(applyWheel(command, 'omegaR', 5)).toEqual({ omegaL_radps: 15, omegaR_radps: 5 });
    expect(applyWheel(command, 'otro', 5)).toBe(command);

    const twist = { v_mps: 0.4, omega_radps: 1.5 };
    expect(applyTwist(twist, 'v', 0.2)).toEqual({ v_mps: 0.2, omega_radps: 1.5 });
    expect(applyTwist(twist, 'omega', 2)).toEqual({ v_mps: 0.4, omega_radps: 2 });
    expect(applyTwist(twist, 'otro', 2)).toBe(twist);
  });

  it('mobileOf rechaza un robot sin perfil móvil', () => {
    expect(() => mobileOf({ ...defaultRobot(), mobile: undefined })).toThrow(/mobile-diff/);
  });
});

describe('DiffDriveWidget panels de odometría (F2-09b)', () => {
  const CALIBRATION = calibrationOf(SPEC);

  it('los tres sliders de calibración usan los rangos de la asignación (#93, decisión 3)', () => {
    const [ticks, radius, base] = calibrationParams(CALIBRATION, t);
    expect(ticks?.min).toBe(16);
    expect(ticks?.max).toBe(4096);
    expect(ticks?.step).toBe(1);
    expect(ticks?.value).toBe(360);
    expect(radius?.min).toBe(0.02);
    expect(radius?.max).toBe(0.05);
    expect(radius?.step).toBe(0.0005);
    expect(radius?.value).toBe(0.032);
    expect(base?.min).toBe(0.1);
    expect(base?.max).toBe(0.25);
    expect(base?.value).toBe(0.15);
  });

  it('cada cambio de calibración toca solo su valor y N_e se redondea a entero', () => {
    expect(applyCalibration(CALIBRATION, 'believedRadius', 0.033)).toEqual({
      ...CALIBRATION,
      wheelRadius_m: 0.033,
    });
    expect(applyCalibration(CALIBRATION, 'believedBase', 0.155)).toEqual({
      ...CALIBRATION,
      wheelBase_m: 0.155,
    });
    expect(applyCalibration(CALIBRATION, 'ticksPerRev', 512.6).ticksPerRev).toBe(513);
    expect(applyCalibration(CALIBRATION, 'omegaL', 5)).toBe(CALIBRATION);
  });
});
