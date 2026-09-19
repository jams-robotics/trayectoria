/**
 * Dynamics of the `ramp` mode of `EnergyWidget` (docs/CURRICULUM.md T-3.1; #90, decisions 1
 * and 3). The body slides along the track — a flat run and then a ramp of angle `φ` — and its
 * state `{ s_m, v_mps }` is integrated with `rk4` from sim-core at a fixed `dt_s`. The energies
 * are never integrated: they are read back from the state in closed form by `compute.ts`, so
 * `E_mec` is conserved by the integrator rather than by construction.
 */
import { rk4 } from '@trayectoria/sim-core';
import type { Model } from '@trayectoria/sim-core';

import { G_MPS2, kineticEnergy, potentialEnergy } from './compute';
import type { Ramp } from './compute';

/** Length of the flat run before the foot of the ramp, in metres (#90, decision 3). */
export const FLAT_LENGTH_M = 0.3;

/** Below this slope there is no ramp to draw and the whole track is flat (#90, decision 3). */
export const MIN_SLOPE_RAD = 0.05;

/** Integration step of the dynamics, in seconds (#90, decision 1). */
export const DT_S = 0.001;

/** The state the integrator advances: distance along the track and speed along it. */
export interface RampState {
  /** Distance travelled along the track from the start of the flat run, in metres. */
  s_m: number;
  /** Speed along the track, in m/s; it never turns negative because the body stops at rest. */
  v_mps: number;
  /** Work the kinetic friction has taken out of the body so far, in joules (always ≥ 0). */
  dissipated_J: number;
}

/** True once the body is at or past the foot of the ramp, where gravity starts to brake it. */
export function onRamp(s_m: number, slope_rad: number): boolean {
  return slope_rad >= MIN_SLOPE_RAD && s_m >= FLAT_LENGTH_M;
}

/**
 * Acceleration along the track, in m/s²: `a = −g sinφ − μ_k g cosφ·sign(v)` on the ramp and
 * `a = −μ_k g·sign(v)` on the flat run (#90, decision 3). Friction only ever opposes the
 * motion, so it vanishes at rest instead of pushing the body backwards.
 */
export function accelAt(ramp: Ramp, s_m: number, v_mps: number): number {
  const slope_rad = onRamp(s_m, ramp.slope_rad) ? ramp.slope_rad : 0;
  const friction_mps2 = ramp.mu_k * G_MPS2 * Math.cos(slope_rad) * Math.sign(v_mps);
  return -G_MPS2 * Math.sin(slope_rad) - friction_mps2;
}

/** Height above the start of the track at a distance `s` along it, in metres (decision 3). */
export function heightAt(s_m: number, slope_rad: number): number {
  if (!onRamp(s_m, slope_rad)) return 0;
  return (s_m - FLAT_LENGTH_M) * Math.sin(slope_rad);
}

/** Magnitude of the friction force on the body, in newtons; zero once it is at rest. */
function frictionForce_N(ramp: Ramp, s_m: number, v_mps: number): number {
  const slope_rad = onRamp(s_m, ramp.slope_rad) ? ramp.slope_rad : 0;
  if (v_mps <= 0) return 0;
  return ramp.mu_k * ramp.mass_kg * G_MPS2 * Math.cos(slope_rad);
}

/**
 * The state of a body that comes to rest inside this step: it advances the `v²/(−2a)` the
 * remaining kinetic energy still buys it, and the share of that advance friction takes is added
 * to the dissipated work, so no energy is lost to where the step happened to land.
 */
function stopped(ramp: Ramp, state: RampState, dt_s: number): RampState {
  const accel_mps2 = accelAt(ramp, state.s_m, state.v_mps);
  const advance_m =
    accel_mps2 < 0
      ? (state.v_mps * state.v_mps) / (-2 * accel_mps2)
      : state.v_mps * dt_s;
  const lost_J = frictionForce_N(ramp, state.s_m, state.v_mps) * advance_m;
  return { s_m: state.s_m + advance_m, v_mps: 0, dissipated_J: state.dissipated_J + lost_J };
}

/**
 * One `rk4` step of `{ s, v }` over `dt_s`, with the body stopped where its speed reaches zero.
 * The acceleration is taken as constant over the step, which it is on either side of the foot
 * of the ramp: `advance` splits a step that crosses it.
 */
function integrate(ramp: Ramp, state: RampState, dt_s: number): RampState {
  const [s_m = state.s_m, v_mps = state.v_mps] = rk4(
    (_t_s, [s = 0, v = 0]) => [v, accelAt(ramp, s, v)],
    [state.s_m, state.v_mps],
    0,
    dt_s,
  );
  // The body stops within this step rather than being let through into negative speeds, where
  // the sign of friction would flip and it would slide back down the ramp. Truncating the step
  // at `v = 0` would also truncate the advance, so the kinetic energy left over would vanish
  // instead of becoming height: the body is stopped where `v` reaches zero, `s + v²/(−2a)`,
  // which is where the remaining energy has all been converted.
  if (v_mps <= 0) return stopped(ramp, state, dt_s);
  const lost_J = frictionForce_N(ramp, state.s_m, state.v_mps) * (s_m - state.s_m);
  return { s_m, v_mps, dissipated_J: state.dissipated_J + lost_J };
}

/**
 * Advances the body by `dt_s`, splitting the step at the foot of the ramp when it crosses it.
 * The acceleration jumps there, and integrating one step across that jump would spend the whole
 * step at the wrong acceleration — a one-off error in `E_mec` the rest of the run keeps.
 */
function advance(ramp: Ramp, state: RampState, dt_s: number): RampState {
  const foot_m = FLAT_LENGTH_M;
  const crosses =
    ramp.slope_rad >= MIN_SLOPE_RAD && state.s_m < foot_m && state.s_m + state.v_mps * dt_s > foot_m;
  if (!crosses) return integrate(ramp, state, dt_s);
  // Time to the foot at the current speed; friction on the flat run barely changes it over one
  // step, and the leftover of the step is then integrated on the ramp side of the jump.
  const toFoot_s = Math.min((foot_m - state.s_m) / state.v_mps, dt_s);
  const atFoot = integrate(ramp, state, toFoot_s);
  if (atFoot.v_mps <= 0) return atFoot;
  return integrate(ramp, { ...atFoot, s_m: Math.max(atFoot.s_m, foot_m) }, dt_s - toFoot_s);
}

/**
 * A `Model` of sim-core whose `step` is one `rk4` step of `{ s, v }` (#90, decision 1). The body
 * stops at rest instead of sliding back down: T-3.1 is about the energy of the climb, and a
 * body held by static friction is out of the scope of the ticket.
 */
export function rampModel(ramp: Ramp): Model<RampState, null> {
  return {
    init: () => ({ s_m: 0, v_mps: Math.max(ramp.v0_mps, 0), dissipated_J: 0 }),
    step: (state, _input, dt_s) => {
      if (state.v_mps <= 0) return state;
      return advance(ramp, state, dt_s);
    },
  };
}

/** The energies of the body at one state of the track, in joules (T-3.1). */
export interface Energies {
  kinetic_J: number;
  potential_J: number;
  mechanical_J: number;
  dissipated_J: number;
  height_m: number;
}

/** Reads the energies back from the integrated state, in closed form (#90, decision 1). */
export function energiesOf(ramp: Ramp, state: RampState): Energies {
  const height_m = heightAt(state.s_m, ramp.slope_rad);
  const kinetic_J = kineticEnergy(ramp.mass_kg, state.v_mps);
  const potential_J = potentialEnergy(ramp.mass_kg, height_m);
  return {
    kinetic_J,
    potential_J,
    mechanical_J: kinetic_J + potential_J,
    dissipated_J: state.dissipated_J,
    height_m,
  };
}

/**
 * Length of track the body may cover, in metres: the flat run plus the climb it would make with
 * no friction, with a margin so the view is never flush with where it stops (#90, decision 3).
 */
export function trackLength_m(ramp: Ramp): number {
  const climb_m =
    ramp.slope_rad >= MIN_SLOPE_RAD
      ? (ramp.v0_mps * ramp.v0_mps) / (2 * G_MPS2 * Math.sin(ramp.slope_rad))
      : (ramp.v0_mps * ramp.v0_mps) / (2 * G_MPS2 * Math.max(ramp.mu_k, 0.02));
  return FLAT_LENGTH_M + 1.2 * climb_m;
}
