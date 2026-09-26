import { describe, expect, it } from 'vitest';
import { Simulation, createDiffDriveModel, radToDeg } from '@trayectoria/sim-core';
import type { DiffDriveState, WheelCommand } from '@trayectoria/sim-core';

import { createFrameClock } from '../Scene2D/useSimulationDriver';
import { defaultRobot, mobileOf } from './compute';
import type { Pose } from './compute';
import {
  DEFAULT_TICKS_PER_REV,
  baseDriftError_deg,
  calibrationOf,
  estimatedVelocity,
  headingError_deg,
  odometryStep,
  positionError_m,
  radiusDriftError_m,
  stepOf,
  ticksAt,
} from './odometry';
import type { Calibration } from './odometry';
import { odometryView } from './scene';
import { DT_S } from './timeline';

/** Absolute tolerance of the golden values of the ticket (#93, decision 2). */
const TOL = 1e-3;

const SPEC = mobileOf(defaultRobot());
/** The exact calibration of the reference robot: r = 0.032, L = 0.15, N_e = 360. */
const EXACT: Calibration = calibrationOf(SPEC);
/** The pose the estimation starts from in the hook of T-5.4. */
const ORIGIN: Pose = { x_m: 0, y_m: 0, theta_rad: 0 };

/** Runs the model of sim-core for `duration_s` at a fixed wheel command (T-5.4, «Explora»). */
function run(command: WheelCommand, duration_s: number): DiffDriveState[] {
  const sim = new Simulation<DiffDriveState, WheelCommand>(createDiffDriveModel(SPEC), {
    dt_s: DT_S,
    seed: 0,
    clock: createFrameClock(),
    input: command,
  });
  const states: DiffDriveState[] = [sim.state];
  for (let done = 0; done < Math.round(duration_s / DT_S); done += 1) {
    sim.step(1);
    states.push(sim.state);
  }
  return states;
}

/** Integrates the whole run with `calibration` and returns the estimated final pose. */
function estimate(states: readonly DiffDriveState[], calibration: Calibration): Pose {
  let pose = ORIGIN;
  let previous = ticksAt(states[0] as DiffDriveState, calibration.ticksPerRev);
  for (const state of states.slice(1)) {
    const ticks = ticksAt(state, calibration.ticksPerRev);
    pose = odometryStep(
      pose,
      stepOf({ left: ticks.left - previous.left, right: ticks.right - previous.right }, calibration),
    );
    previous = ticks;
  }
  return pose;
}

describe('DiffDriveWidget odometry (F2-09b)', () => {
  it('la calibración por defecto es la real del perfil: r = 0.032, L = 0.15, N_e = 360', () => {
    expect(EXACT).toEqual({ wheelRadius_m: 0.032, wheelBase_m: 0.15, ticksPerRev: 360 });
    expect(calibrationOf({ ...SPEC, encoderTicksPerRev: undefined }).ticksPerRev).toBe(
      DEFAULT_TICKS_PER_REV,
    );
  });

  it('400 y 440 ticks dan Δs_L = 0.2234, Δs_R = 0.2457, Δs = 0.2346 m y Δθ = 0.1489 rad (e1)', () => {
    const step = stepOf({ left: 400, right: 440 }, EXACT);
    expect(step.deltaSL_m).toBeCloseTo(0.2234, 3);
    expect(step.deltaSR_m).toBeCloseTo(0.2457, 3);
    expect(step.deltaS_m).toBeCloseTo(0.2346, 3);
    expect(step.deltaTheta_rad).toBeCloseTo(0.1489, 3);
  });

  it('desde (0, 0, 0) ese paso deja la pose en (0.2339, 0.01745, 0.1489) (e2)', () => {
    const pose = odometryStep(ORIGIN, stepOf({ left: 400, right: 440 }, EXACT));
    expect(pose.x_m).toBeCloseTo(0.2339, 3);
    expect(pose.y_m).toBeCloseTo(0.01745, 4);
    expect(pose.theta_rad).toBeCloseTo(0.1489, 3);
  });

  it('el ángulo medio no es el inicial: con θ inicial x sería Δs y y sería 0 (T-5.4)', () => {
    const step = stepOf({ left: 400, right: 440 }, EXACT);
    const mid = odometryStep(ORIGIN, step);
    // Con el ángulo inicial (θ = 0) el paso sería recto: x = Δs = 0.2346 e y = 0. El dorado de
    // e2 es (0.2339, 0.01745), así que la actualización usa el ángulo medio y no el inicial.
    expect(Math.abs(mid.x_m - step.deltaS_m)).toBeGreaterThan(TOL / 2);
    expect(mid.y_m).toBeGreaterThan(0.01);
  });

  it('con radio real 0.033 y creído 0.032 el error de distancia en 10 m es 0.3125 m (e3)', () => {
    expect(radiusDriftError_m(10, 0.032, 0.033)).toBeCloseTo(0.3125, 4);
    expect(radiusDriftError_m(10, 0.032, 0.032)).toBe(0);
  });

  it('con L creída 0.155 y real 0.150 el error de rumbo tras 360° reales es −11.61° (e4, #395)', () => {
    expect(baseDriftError_deg(360, 0.155, 0.15)).toBeCloseTo(-11.61, 1);
    expect(baseDriftError_deg(360, 0.155, 0.155)).toBe(0);
  });

  it('con la calibración exacta la estimación sigue a la pose real salvo cuantización', () => {
    const states = run({ omegaL_radps: 12, omegaR_radps: 13 }, 20);
    const real = states[states.length - 1] as DiffDriveState;
    const pose = estimate(states, EXACT);
    expect(positionError_m(pose, real)).toBeLessThan(0.02);
    expect(Math.abs(headingError_deg(pose, real))).toBeLessThan(1);
  });

  it('con N_e muy alto (1e6) el error de posición tras la corrida es menor que 1 mm', () => {
    const states = run({ omegaL_radps: 12, omegaR_radps: 13 }, 20);
    const real = states[states.length - 1] as DiffDriveState;
    const fine = estimate(states, { ...EXACT, ticksPerRev: 1_000_000 });
    expect(positionError_m(fine, real)).toBeLessThan(1e-3);
    const coarse = estimate(states, { ...EXACT, ticksPerRev: 16 });
    expect(positionError_m(coarse, real)).toBeGreaterThan(positionError_m(fine, real));
  });

  it('un radio creído 1 mm mayor adelanta la estimada y el error crece con la distancia', () => {
    const states = run({ omegaL_radps: 12, omegaR_radps: 12 }, 20);
    const believed: Calibration = { ...EXACT, wheelRadius_m: 0.033 };
    const half = estimate(states.slice(0, Math.floor(states.length / 2)), believed);
    const full = estimate(states, believed);
    const realHalf = states[Math.floor(states.length / 2) - 1] as DiffDriveState;
    const real = states[states.length - 1] as DiffDriveState;
    expect(full.x_m).toBeGreaterThan(real.x_m);
    expect(positionError_m(full, real)).toBeGreaterThan(
      1.8 * positionError_m(half, { x_m: realHalf.x_m, y_m: realHalf.y_m, theta_rad: 0 }),
    );
  });

  it('una L creída 5 mm menor desvía el rumbo estimado en grados (experimento 3)', () => {
    const states = run({ omegaL_radps: -10, omegaR_radps: 10 }, 5);
    const real = states[states.length - 1] as DiffDriveState;
    const believed = estimate(states, { ...EXACT, wheelBase_m: 0.145 });
    expect(Math.abs(headingError_deg(believed, real))).toBeGreaterThan(1);
    expect(Math.abs(headingError_deg(estimate(states, EXACT), real))).toBeLessThan(1);
  });

  it('los ticks salen del ángulo de rueda acumulado y crecen con el tiempo (sim-core)', () => {
    const states = run({ omegaL_radps: 12, omegaR_radps: 13 }, 2);
    const first = ticksAt(states[1] as DiffDriveState, 360);
    const last = ticksAt(states[states.length - 1] as DiffDriveState, 360);
    expect(last.left).toBeGreaterThan(first.left);
    expect(last.right).toBeGreaterThan(last.left);
  });

  it('el error de rumbo se envuelve en (−180°, 180°] (#93, decisión 3)', () => {
    const real: Pose = { x_m: 0, y_m: 0, theta_rad: -Math.PI + 0.1 };
    const estimated: Pose = { x_m: 0, y_m: 0, theta_rad: Math.PI - 0.1 };
    expect(headingError_deg(estimated, real)).toBeCloseTo(radToDeg(-0.2), 6);
    expect(positionError_m(estimated, real)).toBe(0);
  });

  it('la vista de odometría se centra entre las dos poses y no se cierra del todo', () => {
    const real: Pose = { x_m: 1.7, y_m: 2.8, theta_rad: 2 };
    const estimated: Pose = { x_m: 1.65, y_m: 2.9, theta_rad: 2.1 };
    const view = odometryView(real, estimated);
    expect(view.centre_m).toEqual([(1.7 + 1.65) / 2, (2.8 + 2.9) / 2]);
    // Con las dos poses encima la vista no se cierra sobre el chasis: se queda en su mínimo.
    expect(odometryView(real, real).width_m).toBe(1.2);
    // Y con una deriva grande deja de ensancharse en el máximo de la escena.
    expect(odometryView(real, { ...real, x_m: real.x_m + 5 }).width_m).toBe(3);
    expect(view.width_m).toBeGreaterThanOrEqual(1.2);
  });
});

describe('DiffDriveWidget velocidad estimada por encoders (#306, T-4.5)', () => {
  it('45 ticks en 0.1 s con N_e = 360 y r = 0.032 dan 0.2513 m/s (T-4.5 e2)', () => {
    const step = stepOf({ left: 45, right: 45 }, EXACT);
    const velocity = estimatedVelocity(step, 0.1);
    expect(velocity.left_mps).toBeCloseTo(0.2513, 3);
    expect(velocity.right_mps).toBeCloseTo(0.2513, 3);
    expect(velocity.robot_mps).toBeCloseTo(0.2513, 3);
  });

  it('con Δt = 0 la estimación es 0 en vez de dividir por cero', () => {
    const step = stepOf({ left: 45, right: 45 }, EXACT);
    expect(estimatedVelocity(step, 0)).toEqual({ left_mps: 0, right_mps: 0, robot_mps: 0 });
  });

  it('a ω = 1 rad/s con N_e = 20 la estimada solo toma valores múltiplos de 2π·r/(N_e·Δt)', () => {
    const states = run({ omegaL_radps: 1, omegaR_radps: 1 }, 3);
    const calibration: Calibration = { ...EXACT, ticksPerRev: 20 };
    const period = 10; // 10 pasos de DT_S = 0.1 s entre muestras
    const dt_s = period * DT_S;
    const quantum_mps = (2 * Math.PI * EXACT.wheelRadius_m) / (20 * dt_s);
    let previous = ticksAt(states[0] as DiffDriveState, 20);
    let sawNonZero = false;
    for (let i = period; i < states.length; i += period) {
      const ticks = ticksAt(states[i] as DiffDriveState, 20);
      const step = stepOf(
        { left: ticks.left - previous.left, right: ticks.right - previous.right },
        calibration,
      );
      const velocity = estimatedVelocity(step, dt_s);
      const multiple = velocity.left_mps / quantum_mps;
      expect(Math.abs(multiple - Math.round(multiple))).toBeLessThan(1e-9);
      if (velocity.left_mps !== 0) sawNonZero = true;
      previous = ticks;
    }
    // El escalonamiento es el efecto que enseña T-4.5: no todas las muestras dan 0.
    expect(sawNonZero).toBe(true);
  });

  it('con N_e = 2000 la estimada queda a menos del 5 % de la real (T-4.5, experimento 3)', () => {
    const states = run({ omegaL_radps: 1, omegaR_radps: 1 }, 3);
    const calibration: Calibration = { ...EXACT, ticksPerRev: 2000 };
    const period = 10;
    const dt_s = period * DT_S;
    const real_mps = 1 * EXACT.wheelRadius_m; // v = ω r a ω = 1 rad/s
    // Arranca tras la rampa de aceleración del perfil (0.025 s a 40 rad/s²), que hace corto el
    // primer paso de muestreo; a partir de ahí la velocidad real ya es constante.
    let previous = ticksAt(states[period] as DiffDriveState, 2000);
    for (let i = 2 * period; i < states.length; i += period) {
      const ticks = ticksAt(states[i] as DiffDriveState, 2000);
      const step = stepOf(
        { left: ticks.left - previous.left, right: ticks.right - previous.right },
        calibration,
      );
      const velocity = estimatedVelocity(step, dt_s);
      expect(Math.abs(velocity.left_mps - real_mps) / real_mps).toBeLessThan(0.05);
      previous = ticks;
    }
  });
});
