import { describe, expect, test } from 'vitest';

import {
  CURVE_SAMPLES,
  clampSpeed_rpm,
  currentAt_A,
  defaultSpeed_rpm,
  electricalOf,
  electricalPowerAt_W,
  maxPower_W,
  maxPowerSpeed_rpm,
  motorEfficiency,
  powerAt_W,
  sampleCurves,
  torqueAt_Nm,
} from './compute';
import type { Motor, MotorElectrical } from './compute';

/** The reference robot of docs/WIDGETS.md, MotorCurveWidget: τ_s = 0.012 N·m, n₀ = 6000 rpm. */
const MOTOR: Motor = { stallTorque_Nm: 0.012, noLoadSpeed_rpm: 6000 };
/** Its currents and supply: I₀ = 0.1 A, I_s = 1.2 A, V = 6 V (P_el = 3.9 W at 0.65 A). */
const ELECTRICAL: MotorElectrical = { noLoadCurrent_A: 0.1, stallCurrent_A: 1.2, voltage_V: 6 };

describe('MotorCurveWidget compute (W-MOTOR)', () => {
  test('W-MOTOR golden: en 3000 rpm τ = 0.006 N·m, P = 1.885 W, I = 0.65 A, P_el = 3.9 W, η = 0.483', () => {
    expect(torqueAt_Nm(MOTOR, 3000)).toBeCloseTo(0.006, 6);
    expect(powerAt_W(MOTOR, 3000)).toBeCloseTo(1.885, 3);
    expect(currentAt_A(MOTOR, ELECTRICAL, 3000)).toBeCloseTo(0.65, 6);
    expect(electricalPowerAt_W(MOTOR, ELECTRICAL, 3000)).toBeCloseTo(3.9, 6);
    expect(motorEfficiency(MOTOR, ELECTRICAL, 3000)).toBeCloseTo(0.483, 3);
  });

  test('W-MOTOR golden: en 0 rpm τ = τ_s = 0.012 N·m, P = 0 e I = I_s = 1.2 A', () => {
    expect(torqueAt_Nm(MOTOR, 0)).toBeCloseTo(0.012, 6);
    expect(powerAt_W(MOTOR, 0)).toBe(0);
    expect(currentAt_A(MOTOR, ELECTRICAL, 0)).toBeCloseTo(1.2, 6);
  });

  test('W-MOTOR golden: en 6000 rpm τ = 0, P = 0 e I = I₀ = 0.1 A', () => {
    expect(torqueAt_Nm(MOTOR, 6000)).toBeCloseTo(0, 12);
    expect(powerAt_W(MOTOR, 6000)).toBeCloseTo(0, 12);
    expect(currentAt_A(MOTOR, ELECTRICAL, 6000)).toBeCloseTo(0.1, 6);
  });

  test('W-MOTOR golden: con τ_s = 0.024 N·m, P_max = 3.77 W en 3000 rpm', () => {
    const stronger: Motor = { ...MOTOR, stallTorque_Nm: 0.024 };
    expect(maxPower_W(stronger)).toBeCloseTo(3.77, 2);
    expect(maxPowerSpeed_rpm(stronger)).toBe(3000);
    expect(powerAt_W(stronger, 3000)).toBeCloseTo(maxPower_W(stronger), 9);
  });

  test('P_max = τ_s ω₀ / 4 es el máximo de la parábola, en n₀/2', () => {
    expect(maxPower_W(MOTOR)).toBeCloseTo(1.885, 3);
    expect(powerAt_W(MOTOR, maxPowerSpeed_rpm(MOTOR))).toBeCloseTo(maxPower_W(MOTOR), 9);
    expect(powerAt_W(MOTOR, 2000)).toBeLessThan(maxPower_W(MOTOR));
    expect(powerAt_W(MOTOR, 4000)).toBeLessThan(maxPower_W(MOTOR));
  });

  test('el punto de trabajo por defecto es n₀/2', () => {
    expect(defaultSpeed_rpm(MOTOR)).toBe(3000);
  });

  test('la velocidad se recorta a [0, n₀]', () => {
    expect(clampSpeed_rpm(MOTOR, 7000)).toBe(6000);
    expect(clampSpeed_rpm(MOTOR, -5)).toBe(0);
    expect(clampSpeed_rpm(MOTOR, 2500)).toBe(2500);
  });

  test('sin tensión eléctrica no hay eficiencia (0, no división por cero)', () => {
    const noSupply: MotorElectrical = { ...ELECTRICAL, voltage_V: 0 };
    expect(motorEfficiency(MOTOR, noSupply, 3000)).toBe(0);
  });

  test('las curvas muestreadas van de 0 a n₀ y cierran con τ = 0 y P = 0', () => {
    const curves = sampleCurves(MOTOR);
    expect(curves.speed_rpm).toHaveLength(CURVE_SAMPLES);
    expect(curves.torque_Nm).toHaveLength(CURVE_SAMPLES);
    expect(curves.power_W).toHaveLength(CURVE_SAMPLES);
    expect(curves.speed_rpm[0]).toBe(0);
    expect(curves.speed_rpm.at(-1)).toBe(6000);
    expect(curves.torque_Nm[0]).toBeCloseTo(0.012, 6);
    expect(curves.torque_Nm.at(-1)).toBeCloseTo(0, 12);
    expect(curves.power_W[0]).toBe(0);
    expect(curves.power_W.at(-1)).toBeCloseTo(0, 12);
    // The middle sample is the maximum power point.
    expect(curves.power_W[(CURVE_SAMPLES - 1) / 2]).toBeCloseTo(maxPower_W(MOTOR), 9);
  });

  test('electricalOf solo devuelve el modelo eléctrico con I₀, I_s y V a la vez', () => {
    expect(electricalOf({ noLoadCurrent_A: 0.1, stallCurrent_A: 1.2, voltage_V: 6 })).toEqual(
      ELECTRICAL,
    );
    expect(electricalOf({ noLoadCurrent_A: 0.1, stallCurrent_A: 1.2 })).toBeUndefined();
    expect(electricalOf({ voltage_V: 6 })).toBeUndefined();
    expect(electricalOf({})).toBeUndefined();
  });

  test('es determinista: el mismo motor y la misma velocidad dan los mismos valores', () => {
    expect(powerAt_W(MOTOR, 1234)).toBe(powerAt_W({ ...MOTOR }, 1234));
    expect(sampleCurves(MOTOR)).toEqual(sampleCurves({ ...MOTOR }));
  });
});
