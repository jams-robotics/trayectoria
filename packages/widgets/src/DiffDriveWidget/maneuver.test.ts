import { describe, expect, test } from 'vitest';
import { degToRad } from '@trayectoria/sim-core';
import type { DiffDriveState, Model, WheelCommand } from '@trayectoria/sim-core';

import { defaultRobot, mobileOf } from './compute';
import {
  maneuverDuration_s,
  maneuverModel,
  phaseAt,
  phaseCommand,
  phaseDurations_s,
  planOf,
} from './maneuver';
import type { ManeuverPlan } from './maneuver';
import { DT_S } from './timeline';

/** Reference robot of the golden values (docs/WIDGETS.md, DiffDriveWidget). */
const SPEC = mobileOf(defaultRobot());
/** Tolerance of the golden values: 1e-6 in metres and radians. */
const TOLERANCE_DIGITS = 6;
/** Command of the sliders, which the maneuver must ignore. */
const SLIDERS: WheelCommand = { omegaL_radps: 3, omegaR_radps: -2 };
/** The maneuver of T-5.5: 90° and 0.2 m at the default speeds. */
const T55 = planOf({ turn_deg: 90, distance_m: 0.2 }, 90, 0.2);

/** Advances the model from `(0, 0, θ₀)` to `t_s` exactly, in steps of at most `dt_s`. */
function runTo(
  plan: ManeuverPlan | null,
  t_s: number,
  dt_s: number = DT_S,
  theta0_rad = 0,
): DiffDriveState {
  const model: Model<DiffDriveState, WheelCommand> = maneuverModel(SPEC, { current: plan });
  let state: DiffDriveState = { ...model.init(0), theta_rad: theta0_rad };
  while (t_s - state.t_s > 1e-12) {
    state = model.step(state, SLIDERS, Math.min(dt_s, t_s - state.t_s));
  }
  return state;
}

/** Checks a pose against a golden value within the tolerance of the spec. */
function expectPose(state: DiffDriveState, x_m: number, y_m: number, theta_deg: number): void {
  expect(state.x_m).toBeCloseTo(x_m, TOLERANCE_DIGITS);
  expect(state.y_m).toBeCloseTo(y_m, TOLERANCE_DIGITS);
  expect(state.theta_rad).toBeCloseTo(degToRad(theta_deg), TOLERANCE_DIGITS);
}

describe('maniobra en tres movimientos (T-5.5, #394)', () => {
  test('T-5.5 golden: giro 90° y avance 0.2 m duran T = 4.142 s', () => {
    expect(phaseDurations_s(T55)[0]).toBeCloseTo(Math.PI / 2, 12);
    expect(phaseDurations_s(T55)[1]).toBeCloseTo(1, 12);
    expect(phaseDurations_s(T55)[2]).toBeCloseTo(Math.PI / 2, 12);
    expect(maneuverDuration_s(T55)).toBeCloseTo(4.142, 3);
  });

  test('T-5.5 golden: en t = π/2 s la pose es (0, 0, 90°)', () => {
    expectPose(runTo(T55, Math.PI / 2), 0, 0, 90);
  });

  test('T-5.5 golden: en t = π/2 + 0.5 s la pose es (0, 0.1, 90°)', () => {
    expectPose(runTo(T55, Math.PI / 2 + 0.5), 0, 0.1, 90);
  });

  test('T-5.5 golden: al terminar la pose es (0, 0.2, 0°) y el robot queda quieto', () => {
    expectPose(runTo(T55, maneuverDuration_s(T55)), 0, 0.2, 0);
    const after = runTo(T55, maneuverDuration_s(T55) + 1);
    expectPose(after, 0, 0.2, 0);
    expect(after.v_mps).toBe(0);
    expect(after.omega_radps).toBe(0);
  });

  test('T-5.5 golden: con giro −90° termina en (0, −0.2, 0°)', () => {
    const plan = planOf({ turn_deg: -90, distance_m: 0.2 }, -90, 0.2);
    expectPose(runTo(plan, maneuverDuration_s(plan)), 0, -0.2, 0);
  });

  test('T-5.5 golden: con θ₀ = 30° termina en (−0.1, 0.1732, 30°)', () => {
    const end = runTo(T55, maneuverDuration_s(T55), DT_S, degToRad(30));
    expectPose(end, -0.1, 0.2 * Math.sin(degToRad(120)), 30);
    expect(end.y_m).toBeCloseTo(0.1732, 4);
  });

  test('T-5.5 golden: con 4 rad/s y 0.5 m/s, T = 1.185 s', () => {
    const plan = planOf({ turn_deg: 90, distance_m: 0.2, omega_radps: 4, v_mps: 0.5 }, 90, 0.2);
    expect(maneuverDuration_s(plan)).toBeCloseTo(1.185, 3);
    expectPose(runTo(plan, maneuverDuration_s(plan)), 0, 0.2, 0);
  });

  test('la pose no depende del paso de integración: cada cambio de fase cae en su instante', () => {
    const end_s = maneuverDuration_s(T55);
    for (const dt_s of [0.037, 0.25, 1]) {
      const state = runTo(T55, end_s, dt_s);
      expect(state.x_m).toBeCloseTo(runTo(T55, end_s).x_m, 12);
      expect(state.y_m).toBeCloseTo(runTo(T55, end_s).y_m, 12);
      expect(state.theta_rad).toBeCloseTo(runTo(T55, end_s).theta_rad, 12);
    }
    expectPose(runTo(T55, Math.PI / 2 + 0.5, 0.3), 0, 0.1, 90);
  });

  test('es determinista: dos ejecuciones dan el mismo estado bit a bit', () => {
    expect(runTo(T55, 3.3)).toEqual(runTo(T55, 3.3));
  });

  test('sin rampa de maxAccel: el primer paso ya gira a 1 rad/s', () => {
    expect(SPEC.maxAccel_radps2).toBeDefined();
    const first = runTo(T55, DT_S);
    expect(first.omega_radps).toBeCloseTo(1, 12);
    expect(first.theta_rad).toBeCloseTo(DT_S, 12);
  });

  test('sin maniobra el modelo sigue el comando de los sliders con su rampa', () => {
    const first = runTo(null, DT_S);
    expect(first.omega_radps).not.toBe(0);
    const target_radps =
      ((SLIDERS.omegaR_radps - SLIDERS.omegaL_radps) * SPEC.wheelRadius_m) / SPEC.wheelBase_m;
    expect(Math.abs(first.omega_radps)).toBeLessThan(Math.abs(target_radps));
  });

  test('una fase de duración 0 se salta', () => {
    const straight = planOf({ turn_deg: 0, distance_m: 0.3 }, 0, 0.3);
    expect(phaseAt(straight, 0)).toBe(2);
    expect(phaseAt(straight, 1.5)).toBe('done');
    const turn = planOf({ turn_deg: 45, distance_m: 0 }, 45, 0);
    expect(phaseAt(turn, Math.PI / 4 + 0.01)).toBe(3);
    expectPose(runTo(turn, 2), 0, 0, 0);
  });

  test('las fases se suceden en sus instantes y cada una manda su cinemática inversa', () => {
    expect(phaseAt(T55, 0)).toBe(1);
    expect(phaseAt(T55, Math.PI / 2 + 0.1)).toBe(2);
    expect(phaseAt(T55, Math.PI / 2 + 1.1)).toBe(3);
    expect(phaseAt(T55, maneuverDuration_s(T55))).toBe('done');
    const turning = phaseCommand(T55, 1, SPEC);
    expect(turning.omegaL_radps).toBeCloseTo(-turning.omegaR_radps, 12);
    const advancing = phaseCommand(T55, 2, SPEC);
    expect(advancing.omegaL_radps).toBeCloseTo(0.2 / SPEC.wheelRadius_m, 12);
    expect(phaseCommand(T55, 'done', SPEC)).toEqual({ omegaL_radps: 0, omegaR_radps: 0 });
  });

  test('las rapideces por defecto son 1 rad/s y 0.2 m/s', () => {
    expect(T55.omega_radps).toBe(1);
    expect(T55.v_mps).toBe(0.2);
  });
});
