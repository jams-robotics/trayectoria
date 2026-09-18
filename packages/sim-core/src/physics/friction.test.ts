import { describe, expect, it } from 'vitest';

import { radToDeg } from '../math/angles';
import {
  forceFromTorque_N,
  frictionForce_N,
  maxAccelNoSlip_mps2,
  maxSlopeAngle_rad,
} from './friction';

describe('maxAccelNoSlip_mps2', () => {
  it('T-2.2 e1: mu_s = 0.6 allows 5.886 m/s^2 with all the weight on driven wheels', () => {
    expect(maxAccelNoSlip_mps2(0.6)).toBeCloseTo(5.886, 3);
  });

  it('T-2.2 e3: with beta = 0.6 of the weight on driven wheels it drops to 3.532 m/s^2', () => {
    expect(maxAccelNoSlip_mps2(0.6) * 0.6).toBeCloseTo(3.532, 3);
  });

  it('halves when mu_s halves', () => {
    expect(maxAccelNoSlip_mps2(0.3)).toBeCloseTo(maxAccelNoSlip_mps2(0.6) / 2, 12);
  });
});

describe('maxSlopeAngle_rad', () => {
  it('T-2.2 e2: mu_s = 0.6 holds up to 30.96 deg', () => {
    expect(radToDeg(maxSlopeAngle_rad(0.6))).toBeCloseTo(30.96, 1);
  });

  it('satisfies tan(phi) = mu_s', () => {
    expect(Math.tan(maxSlopeAngle_rad(0.45))).toBeCloseTo(0.45, 12);
  });

  it('is 45 deg for mu_s = 1 and flat for mu_s = 0', () => {
    expect(radToDeg(maxSlopeAngle_rad(1))).toBeCloseTo(45, 12);
    expect(maxSlopeAngle_rad(0)).toBe(0);
  });
});

describe('frictionForce_N', () => {
  it('T-2.3 "Al robot": mu_s = 0.6 with beta.m.g = 0.6 * 0.9 * 9.81 N gives f_max = 3.18 N', () => {
    const normal_N = 0.6 * 0.9 * 9.81;
    expect(frictionForce_N(0.6, normal_N)).toBeCloseTo(3.18, 2);
  });

  it('T-2.2 e4: braking from 0.6 m/s with mu_k = 0.45 needs 0.04077 m', () => {
    const mass_kg = 0.9;
    const normal_N = mass_kg * 9.81;
    const decel_mps2 = frictionForce_N(0.45, normal_N) / mass_kg;
    expect((0.6 * 0.6) / (2 * decel_mps2)).toBeCloseTo(0.04077, 5);
  });

  it('T-2.1 e2: on a level plane the normal of a 0.9 kg robot is 8.829 N', () => {
    const normal_N = 0.9 * 9.81;
    expect(normal_N).toBeCloseTo(8.829, 3);
    expect(frictionForce_N(0.6, normal_N)).toBeCloseTo(0.6 * 8.829, 12);
  });

  it('is proportional to the normal force', () => {
    expect(frictionForce_N(0.6, 20)).toBeCloseTo(2 * frictionForce_N(0.6, 10), 12);
  });
});

describe('forceFromTorque_N', () => {
  it('T-2.3 e2: 0.216 N.m over a 0.032 m wheel gives 6.75 N', () => {
    expect(forceFromTorque_N(0.216, 0.032)).toBeCloseTo(6.75, 6);
  });

  it('T-2.3 e3: 0.04832 N.m per wheel climbs a 20 deg slope with 0.9 kg', () => {
    const along_N = 0.9 * 9.81 * Math.sin((20 * Math.PI) / 180);
    expect(forceFromTorque_N(0.04832, 0.032) * 2).toBeCloseTo(along_N, 2);
  });

  it('T-2.3 e4: a 0.2 m arm holding 0.5 kg needs 0.981 N.m at the joint', () => {
    const weight_N = 0.5 * 9.81;
    expect(forceFromTorque_N(0.981, 0.2)).toBeCloseTo(weight_N, 6);
  });

  it('throws when the radius is not positive', () => {
    expect(() => forceFromTorque_N(0.216, 0)).toThrow(RangeError);
  });
});
