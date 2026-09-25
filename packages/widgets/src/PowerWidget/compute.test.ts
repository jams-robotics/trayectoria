import { describe, expect, test } from 'vitest';

import { heightAt, liftSpeed, potentialEnergyAt, riseTime, topEnergy, workAt } from './compute';

/** The golden case of docs/WIDGETS.md, PowerWidget: 4.32 W lifting 0.9 kg by 1 m. */
const LIFT = { power_W: 4.32, mass_kg: 0.9, liftHeight_m: 1 } as const;

describe('PowerWidget compute (#360)', () => {
  test('v = P / (m g) = 0.4893 m/s and t_subida = m g H / P = 2.044 s', () => {
    expect(liftSpeed(LIFT)).toBeCloseTo(0.4893, 4);
    expect(riseTime(LIFT)).toBeCloseTo(2.044, 3);
  });

  test('la energía potencial final es m g H = 8.829 J', () => {
    expect(topEnergy(LIFT)).toBeCloseTo(8.829, 3);
    expect(potentialEnergyAt(LIFT, riseTime(LIFT))).toBeCloseTo(8.829, 3);
  });

  test('en t = 1 s la carga está en h = 0.4893 m con E_p = P t = 4.32 J', () => {
    expect(heightAt(LIFT, 1)).toBeCloseTo(0.4893, 4);
    expect(potentialEnergyAt(LIFT, 1)).toBeCloseTo(4.32, 6);
    expect(workAt(LIFT, 1)).toBeCloseTo(4.32, 6);
  });

  test('el doble de potencia sube en la mitad: P = 8.64 W da t_subida = 1.022 s', () => {
    expect(riseTime({ ...LIFT, power_W: 8.64 })).toBeCloseTo(1.022, 3);
  });

  test('el doble de masa tarda el doble: m = 1.8 kg da t_subida = 4.088 s', () => {
    expect(riseTime({ ...LIFT, mass_kg: 1.8 })).toBeCloseTo(4.088, 3);
  });

  test('pasado t_subida la carga queda arriba en H', () => {
    expect(heightAt(LIFT, 10)).toBe(1);
    expect(potentialEnergyAt(LIFT, 10)).toBeCloseTo(8.829, 3);
    // The motor stops at the top, so the work it has delivered stays at m g H.
    expect(workAt(LIFT, 10)).toBeCloseTo(8.829, 3);
  });

  test('un tiempo negativo se lee como el inicio', () => {
    expect(heightAt(LIFT, -1)).toBe(0);
    expect(workAt(LIFT, -1)).toBe(0);
  });

  test('es determinista: mismos datos y mismo t dan los mismos valores', () => {
    expect(heightAt(LIFT, 0.73)).toBe(heightAt({ ...LIFT }, 0.73));
  });
});
