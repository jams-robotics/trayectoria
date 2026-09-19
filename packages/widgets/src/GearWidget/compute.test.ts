import { describe, expect, it } from 'vitest';

import {
  MODULE_M,
  angleAt,
  inputPower_W,
  outputOmega_radps,
  outputPower_W,
  outputSign,
  outputSpeed_rpm,
  outputTorque_Nm,
  pitchRadius_m,
  ratioFromSpeeds,
  rpmToRadps,
  shaftPower_W,
  shaftSpeeds,
  stageRatio,
  totalRatio,
} from './compute';
import type { Train } from './compute';

/** Relative tolerance of the golden values of the ticket (#91, decision 2). */
const TOL = 1e-3;

/** Asserts `actual` is within the relative tolerance of the golden `expected`. */
function closeTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(TOL);
}

/** The «Explora» of T-4.4: the two stage train 12:60 and 10:50 of the motor of the profile. */
const TRAIN: Train = {
  z1: 12,
  z2: 60,
  z3: 10,
  z4: 50,
  nIn_rpm: 6000,
  torqueIn_Nm: 0.012,
  efficiency: 0.6,
};

/** The single stage case of the golden values: only the first pair, `i = 30`. */
const SINGLE: Train = { ...TRAIN, z2: 360 };

describe('relación de transmisión (F2-08)', () => {
  it('6000 rpm a 200 rpm son i = 30 (e1 de T-4.4)', () => {
    closeTo(ratioFromSpeeds(6000, 200), 30);
  });

  it('una etapa con i = 30 baja 6000 rpm a 200 rpm (e1 de T-4.4)', () => {
    closeTo(totalRatio(1, SINGLE), 30);
    closeTo(outputSpeed_rpm(1, SINGLE), 200);
  });

  it('el tren 12:60 y 10:50 da i_total = 25 y n_out = 240 rpm (e3 de T-4.4)', () => {
    closeTo(stageRatio(TRAIN.z1, TRAIN.z2), 5);
    closeTo(stageRatio(TRAIN.z3, TRAIN.z4), 5);
    closeTo(totalRatio(2, TRAIN), 25);
    closeTo(outputSpeed_rpm(2, TRAIN), 240);
  });

  it('invertir z1 y z2 multiplica la velocidad y divide el torque (experimento 2 de T-4.4)', () => {
    const inverted: Train = { ...SINGLE, z1: SINGLE.z2, z2: SINGLE.z1 };
    closeTo(totalRatio(1, inverted), 1 / 30);
    closeTo(outputSpeed_rpm(1, inverted), 180000);
    closeTo(outputTorque_Nm(1, inverted), (0.012 * 0.6) / 30);
  });

  it('sin dientes de entrada la relación y la velocidad de salida son cero', () => {
    const empty: Train = { ...TRAIN, z1: 0 };
    expect(stageRatio(0, 60)).toBe(0);
    expect(totalRatio(1, empty)).toBe(0);
    expect(outputSpeed_rpm(1, empty)).toBe(0);
  });

  it('una salida detenida da una relación infinita', () => {
    expect(ratioFromSpeeds(6000, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('torque y potencia de salida (F2-08)', () => {
  it('τ_out(0.012, i = 30, η = 0.6) = 0.216 N·m (e2 de T-4.4)', () => {
    closeTo(outputTorque_Nm(1, SINGLE), 0.216);
  });

  it('el tren de dos etapas con i = 25 da τ_out = 0.18 N·m (T-4.4)', () => {
    closeTo(outputTorque_Nm(2, TRAIN), 0.012 * 25 * 0.6);
  });

  it('P_out = P_in · η, y P = τ ω en cada eje (T-4.4)', () => {
    closeTo(inputPower_W(TRAIN), 0.012 * rpmToRadps(6000));
    closeTo(outputPower_W(TRAIN), inputPower_W(TRAIN) * 0.6);
    // El eje de salida cierra el balance: τ_out · ω_out = P_in · η.
    closeTo(shaftPower_W(outputTorque_Nm(2, TRAIN), outputSpeed_rpm(2, TRAIN)), outputPower_W(TRAIN));
  });

  it('con η = 1 la potencia de salida es la de entrada (ideal)', () => {
    const ideal: Train = { ...TRAIN, efficiency: 1 };
    closeTo(outputPower_W(ideal), inputPower_W(ideal));
  });
});

describe('sentidos de giro (F2-08)', () => {
  it('con una etapa la salida gira en sentido contrario (signo de ω_out)', () => {
    expect(outputSign(1)).toBe(-1);
    expect(outputOmega_radps(1, SINGLE)).toBeLessThan(0);
    closeTo(outputOmega_radps(1, SINGLE), -rpmToRadps(200));
  });

  it('con dos etapas la salida gira en el mismo sentido que la entrada', () => {
    expect(outputSign(2)).toBe(1);
    expect(outputOmega_radps(2, TRAIN)).toBeGreaterThan(0);
    closeTo(outputOmega_radps(2, TRAIN), rpmToRadps(240));
  });

  it('los ejes alternan de signo par a par (experimento 3 de T-4.4)', () => {
    const speeds = shaftSpeeds(2, TRAIN);
    expect(speeds.omega1_radps).toBeGreaterThan(0);
    expect(speeds.omega2_radps).toBeLessThan(0);
    expect(speeds.omega4_radps).toBeGreaterThan(0);
    // z3 va en el eje de z2, así que la segunda etapa parte de ω2 (#91, decisión 3).
    closeTo(Math.abs(speeds.omega2_radps), rpmToRadps(1200));
    closeTo(speeds.omega4_radps, rpmToRadps(240));
  });

  it('con una etapa el eje de salida es el de z2', () => {
    const speeds = shaftSpeeds(1, SINGLE);
    expect(speeds.omega4_radps).toBe(speeds.omega2_radps);
    expect(speeds.omega4_radps).toBeLessThan(0);
  });
});

describe('geometría y ángulos (F2-08)', () => {
  it('el radio primitivo es r = m z / 2 (#91, decisión 3)', () => {
    closeTo(pitchRadius_m(12), (MODULE_M * 12) / 2);
    closeTo(pitchRadius_m(60), 0.06);
    // Los radios son proporcionales a los dientes: 60 dientes son cinco veces 12.
    closeTo(pitchRadius_m(60) / pitchRadius_m(12), 5);
  });

  it('θ = ω t en cada engranaje', () => {
    closeTo(angleAt(rpmToRadps(6000), 0.5), rpmToRadps(6000) * 0.5);
    expect(angleAt(rpmToRadps(6000), 0)).toBe(0);
  });
});
