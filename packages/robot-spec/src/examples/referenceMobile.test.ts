import { describe, expect, test } from 'vitest';

import { RobotSpec } from '../schema';
import { referenceMobile } from './referenceMobile';

const RPM_TO_RADPS = (2 * Math.PI) / 60;

describe('F1-01 reference mobile robot (docs/ROBOT-SPEC.md §3)', () => {
  const mobile = RobotSpec.parse(referenceMobile).mobile;
  if (mobile === undefined) throw new Error('reference robot has no mobile section');

  test('has the values of the spec', () => {
    expect(referenceMobile.kind).toBe('mobile-diff');
    expect(referenceMobile.name).toBe('Robot de referencia');
    expect(mobile).toEqual({
      wheelRadius_m: 0.032,
      wheelBase_m: 0.15,
      maxMotorSpeed_rpm: 6000,
      gearRatio: 30,
      maxAccel_radps2: 40,
      encoderTicksPerRev: 360,
      mass_kg: 0.9,
      length_m: 0.18,
      width_m: 0.16,
      lineSensors: { count: 5, spacing_m: 0.012, forwardOffset_m: 0.09, footprint_m: 0.004 },
      motor: { stallTorque_Nm: 0.012, nominalVoltage_V: 6, efficiency: 0.6 },
      battery: { capacity_Wh: 11.1 },
    });
  });

  test('golden derived values: omegaMax_radps = 20.944, vMax_mps = 0.670', () => {
    const omegaMax_radps = (mobile.maxMotorSpeed_rpm * RPM_TO_RADPS) / mobile.gearRatio;
    expect(omegaMax_radps).toBeCloseTo(20.944, 3);
    expect(omegaMax_radps * mobile.wheelRadius_m).toBeCloseTo(0.67, 3);
  });

  test('golden derived values: spin, stall torque, traction and sensor half-width', () => {
    const vL_mps = 0.3;
    const omega_radps = (2 * vL_mps) / mobile.wheelBase_m;
    expect(omega_radps).toBeCloseTo(4, 6);

    if (mobile.motor === undefined) throw new Error('reference robot has no motor');
    const wheelStallTorque_Nm =
      mobile.motor.stallTorque_Nm * mobile.gearRatio * mobile.motor.efficiency;
    expect(wheelStallTorque_Nm).toBeCloseTo(0.216, 6);
    expect(wheelStallTorque_Nm / mobile.wheelRadius_m).toBeCloseTo(6.75, 6);

    const halfWidth_m = ((mobile.lineSensors.count - 1) / 2) * mobile.lineSensors.spacing_m;
    expect(halfWidth_m).toBeCloseTo(0.024, 6);
  });
});
