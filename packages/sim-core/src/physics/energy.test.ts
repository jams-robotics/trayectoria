import { describe, expect, it } from 'vitest';

import { rpmToRadps } from '../math/units';
import {
  kineticEnergy_J,
  mechanicalEnergy_J,
  potentialEnergy_J,
  power_W,
} from './energy';

describe('kineticEnergy_J', () => {
  it('T-3.1 e1: 0.9 kg at 0.6 m/s stores 0.162 J', () => {
    expect(kineticEnergy_J(0.9, 0.6)).toBeCloseTo(0.162, 6);
  });

  it('T-3.1 e3: the net work to go from rest to 0.6 m/s equals 0.162 J', () => {
    expect(kineticEnergy_J(0.9, 0.6) - kineticEnergy_J(0.9, 0)).toBeCloseTo(0.162, 6);
  });

  it('T-3.1 "Al robot": 0.9 kg at v_max = 0.670 m/s stores 0.202 J', () => {
    expect(kineticEnergy_J(0.9, 0.67)).toBeCloseTo(0.202, 3);
  });

  it('grows with the square of the speed and is never negative', () => {
    expect(kineticEnergy_J(0.9, 1.2)).toBeCloseTo(4 * kineticEnergy_J(0.9, 0.6), 12);
    expect(kineticEnergy_J(0.9, -0.6)).toBeCloseTo(0.162, 6);
  });
});

describe('potentialEnergy_J', () => {
  it('0.9 kg at 0.25 m stores m g h', () => {
    expect(potentialEnergy_J(0.9, 0.25)).toBeCloseTo(0.9 * 9.81 * 0.25, 12);
  });

  it('is zero at the reference height', () => {
    expect(potentialEnergy_J(0.9, 0)).toBe(0);
  });
});

describe('mechanicalEnergy_J', () => {
  it('T-3.1 e2: kinetic energy at 0.6 m/s converts to a height of 0.01835 m', () => {
    const mass_kg = 0.9;
    const height_m = 0.01835;
    expect(mechanicalEnergy_J(mass_kg, 0.6, 0)).toBeCloseTo(
      mechanicalEnergy_J(mass_kg, 0, height_m),
      4,
    );
  });

  it('T-3.1 "Al robot": 0.9 kg at 0.670 m/s coasts up to 0.0229 m', () => {
    expect(mechanicalEnergy_J(0.9, 0.67, 0)).toBeCloseTo(mechanicalEnergy_J(0.9, 0, 0.0229), 3);
  });

  it('adds the kinetic and the potential terms', () => {
    expect(mechanicalEnergy_J(0.9, 0.6, 0.25)).toBeCloseTo(
      kineticEnergy_J(0.9, 0.6) + potentialEnergy_J(0.9, 0.25),
      12,
    );
  });

  it('is conserved along a projectile flight without drag', () => {
    const mass_kg = 0.2;
    const v0_mps = 4;
    const angle_rad = Math.PI / 4;
    const h0_m = 0.3;
    const g_mps2 = 9.81;
    const launch_J = mechanicalEnergy_J(mass_kg, v0_mps, h0_m);
    for (const t_s of [0.1, 0.2, 0.4]) {
      const vx_mps = v0_mps * Math.cos(angle_rad);
      const vy_mps = v0_mps * Math.sin(angle_rad) - g_mps2 * t_s;
      const y_m = h0_m + v0_mps * Math.sin(angle_rad) * t_s - 0.5 * g_mps2 * t_s * t_s;
      const speed_mps = Math.hypot(vx_mps, vy_mps);
      expect(mechanicalEnergy_J(mass_kg, speed_mps, y_m)).toBeCloseTo(launch_J, 10);
    }
  });
});

describe('power_W', () => {
  it('T-3.1 e4: 0.4 N along 4 m dissipates 1.6 J, delivered in 4 s it is 0.4 W', () => {
    const dissipated_J = 0.4 * 4;
    expect(dissipated_J).toBeCloseTo(1.6, 12);
    expect(power_W(dissipated_J, 4)).toBeCloseTo(0.4, 12);
  });

  it('T-3.2 e1: 0.03 N.m at 5000 rpm is 15.71 W', () => {
    const omega_radps = rpmToRadps(5000);
    const work_J = 0.03 * omega_radps;
    expect(power_W(work_J, 1)).toBeCloseTo(15.71, 2);
  });

  it('T-3.2 e4: 1.2 N at 0.5 m/s is 0.6 W', () => {
    expect(power_W(1.2 * 0.5, 1)).toBeCloseTo(0.6, 12);
  });

  it('T-3.2 e3: 11.1 Wh drained by two motors at 6 V and 1.2 A lasts 46.25 min', () => {
    const electric_W = 2 * 6 * 1.2;
    const battery_J = 11.1 * 3600;
    const autonomy_s = battery_J / electric_W;
    expect(autonomy_s / 60).toBeCloseTo(46.25, 2);
    expect(power_W(battery_J, autonomy_s)).toBeCloseTo(electric_W, 10);
  });

  it('T-3.2 e2: 6 V, 1.2 A at 60 % efficiency delivers 4.32 W mechanical', () => {
    const mechanical_J = 6 * 1.2 * 0.6;
    expect(power_W(mechanical_J, 1)).toBeCloseTo(4.32, 12);
  });

  it('is zero work over any positive time', () => {
    expect(power_W(0, 2)).toBe(0);
  });

  it('F0-02c: throws RangeError when t_s is not positive', () => {
    expect(() => power_W(1, 0)).toThrow(RangeError);
    expect(() => power_W(1, -1)).toThrow(RangeError);
  });
});
