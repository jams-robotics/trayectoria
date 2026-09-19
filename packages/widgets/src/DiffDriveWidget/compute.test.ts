import { describe, expect, it } from 'vitest';
import { degToRad, radToDeg } from '@trayectoria/sim-core';

import {
  defaultRobot,
  forwardKinematics,
  headingTo,
  icrOf,
  inverseKinematics,
  isFeasible,
  maxSpeed_mps,
  maxWheelSpeed_radps,
  mobileOf,
  rotationMatrix,
  saturate,
  toGlobal,
  toRobot,
  turningRadius_m,
  wheelCentres,
  wheelSpeed_mps,
} from './compute';
import type { Pose } from './compute';

/** Relative tolerance of the golden values of the ticket (#92, decision 2). */
const TOL = 1e-3;

/** Asserts `actual` is within the relative tolerance of the golden `expected`. */
function closeTo(actual: number, expected: number): void {
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThanOrEqual(TOL);
}

const SPEC = mobileOf(defaultRobot());

/** The pose of the hook of T-5.1: (1.2, 0.5) m pointing at 30°. */
const POSE: Pose = { x_m: 1.2, y_m: 0.5, theta_rad: degToRad(30) };

describe('DiffDriveWidget compute (F2-09a)', () => {
  it('el robot de referencia tiene r = 0.032, L = 0.15 y ω_max = 20.94 rad/s', () => {
    expect(SPEC.wheelRadius_m).toBe(0.032);
    expect(SPEC.wheelBase_m).toBe(0.15);
    closeTo(maxWheelSpeed_radps(SPEC), 20.944);
    closeTo(maxSpeed_mps(SPEC), 0.67);
  });

  it('el sensor central (0.09, 0) de {R} está en (1.278, 0.545) global (e1 de T-5.1)', () => {
    const [x_m, y_m] = toGlobal(POSE, [0.09, 0]);
    closeTo(x_m, 1.278);
    closeTo(y_m, 0.545);
  });

  it('el sensor extremo (0.09, 0.024) de {R} está en (1.266, 0.5658) global (e2 de T-5.1)', () => {
    const [x_m, y_m] = toGlobal(POSE, [0.09, 0.024]);
    closeTo(x_m, 1.266);
    closeTo(y_m, 0.5658);
  });

  it('el punto global (1.5, 0.9) está en (0.4598, 0.1964) de {R} (e4 de T-5.1)', () => {
    const [x_m, y_m] = toRobot(POSE, [1.5, 0.9]);
    closeTo(x_m, 0.4598);
    closeTo(y_m, 0.1964);
  });

  it('el rumbo desde (0, 0) hacia (1, 1) es 45° (e3 de T-5.1)', () => {
    const heading_rad = headingTo({ x_m: 0, y_m: 0, theta_rad: 0 }, [1, 1]);
    expect(radToDeg(heading_rad)).toBeCloseTo(45, 1);
  });

  it('con θ = 90° la matriz R(θ) tiene cos = 0 y sin = 1 (experimento 3 de T-5.1)', () => {
    const [cos, minusSin, sin, cosAgain] = rotationMatrix(degToRad(90));
    expect(cos).toBeCloseTo(0, 6);
    expect(minusSin).toBeCloseTo(-1, 6);
    expect(sin).toBeCloseTo(1, 6);
    expect(cosAgain).toBeCloseTo(0, 6);
  });

  it('ω_L = 15 y ω_R = 20 dan v = 0.56 m/s, ω = 1.067 rad/s y R = 0.525 m (e1 y e2 de T-5.2)', () => {
    const twist = forwardKinematics(15, 20, SPEC);
    closeTo(twist.v_mps, 0.56);
    closeTo(twist.omega_radps, 1.067);
    closeTo(turningRadius_m(twist), 0.525);
  });

  it('ω_L = −ω_R = 10 da ω = 4.267 rad/s y 8.533 rad en 2 s (e3 y e4 de T-5.2)', () => {
    const twist = forwardKinematics(-10, 10, SPEC);
    closeTo(twist.omega_radps, 4.267);
    closeTo(twist.omega_radps * 2, 8.533);
    expect(twist.v_mps).toBeCloseTo(0, 12);
  });

  it('con ω_L = ω_R el radio es infinito y no hay CIR (experimento 1 de T-5.2)', () => {
    const twist = forwardKinematics(12, 12, SPEC);
    expect(turningRadius_m(twist)).toBe(Number.POSITIVE_INFINITY);
    expect(icrOf({ x_m: 0, y_m: 0, theta_rad: 0 }, twist)).toBeNull();
  });

  it('con ω_L = 0 el CIR está sobre la rueda izquierda y R = L/2 (experimento 3 de T-5.2)', () => {
    const twist = forwardKinematics(0, 20, SPEC);
    closeTo(turningRadius_m(twist), SPEC.wheelBase_m / 2);
    const icr_m = icrOf({ x_m: 0, y_m: 0, theta_rad: 0 }, twist);
    expect(icr_m).not.toBeNull();
    closeTo(icr_m?.[1] ?? 0, SPEC.wheelBase_m / 2);
    expect(icr_m?.[0] ?? 1).toBeCloseTo(0, 12);
  });

  it('el CIR gira con la pose: a θ = 90° queda a la izquierda en −x (T-5.1 y T-5.2)', () => {
    const twist = forwardKinematics(15, 20, SPEC);
    const icr_m = icrOf({ x_m: 1, y_m: 0, theta_rad: degToRad(90) }, twist);
    closeTo(icr_m?.[0] ?? 0, 1 - 0.525);
    expect(icr_m?.[1] ?? 1).toBeCloseTo(0, 12);
  });

  it('v = 0.4 y ω = 1.5 dan ω_L = 8.984 y ω_R = 16.02 rad/s, realizables (e1 de T-5.3)', () => {
    const command = inverseKinematics(0.4, 1.5, SPEC);
    closeTo(command.omegaL_radps, 8.984);
    closeTo(command.omegaR_radps, 16.02);
    expect(isFeasible(command, SPEC)).toBe(true);
  });

  it('v = 0.6 y ω = 2 piden v_R = 0.75 m/s > 0.670 y no son realizables (e4 de T-5.3)', () => {
    const command = inverseKinematics(0.6, 2, SPEC);
    closeTo(wheelSpeed_mps(command.omegaR_radps, SPEC), 0.75);
    expect(isFeasible(command, SPEC)).toBe(false);
    closeTo(wheelSpeed_mps(saturate(command, SPEC).omegaR_radps, SPEC), 0.67);
  });

  // El enunciado de e2 es «círculo de radio R a v» con los datos 0.4 y 0.3, así que R = 0.4 m y
  // v = 0.3 m/s: son los únicos que dan las velocidades doradas (su media es v y su
  // semidiferencia ω L/2 con ω = v/R = 0.75 rad/s).
  it('un círculo de R = 0.4 m a v = 0.3 m/s da v_L = 0.2437 y v_R = 0.3562 m/s (e2 de T-5.3)', () => {
    const command = inverseKinematics(0.3, 0.3 / 0.4, SPEC);
    closeTo(wheelSpeed_mps(command.omegaL_radps, SPEC), 0.2437);
    closeTo(wheelSpeed_mps(command.omegaR_radps, SPEC), 0.3562);
  });

  it('el pivote con v_L = 0 y v_R = 0.5 da ω = 3.333 rad/s y R = 0.075 m (e3 de T-5.3)', () => {
    const twist = forwardKinematics(0, 0.5 / SPEC.wheelRadius_m, SPEC);
    closeTo(twist.omega_radps, 3.333);
    closeTo(turningRadius_m(twist), 0.075);
  });

  it('las ruedas están sobre el eje a ±L/2 y la saturación respeta lo realizable', () => {
    expect(wheelCentres(SPEC)).toEqual([
      [0, 0.075],
      [0, -0.075],
    ]);
    const command = { omegaL_radps: 8.984, omegaR_radps: 16.02 };
    expect(saturate(command, SPEC)).toEqual(command);
    expect(saturate({ omegaL_radps: -40, omegaR_radps: 40 }, SPEC).omegaL_radps).toBeCloseTo(
      -maxWheelSpeed_radps(SPEC),
      12,
    );
  });
});
