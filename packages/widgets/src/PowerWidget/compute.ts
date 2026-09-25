/**
 * Closed forms of `PowerWidget` (docs/WIDGETS.md, PowerWidget): a motor lifts a load at a
 * constant speed, in steady state, with no start-up, friction or losses. `P` is the mechanical
 * power delivered to the load and `g` is `G_MPS2` of `sim-core`.
 */
import { G_MPS2 } from '@trayectoria/sim-core';

/** What the lift depends on: the power, the mass and the fixed height of the lift. */
export interface Lift {
  power_W: number;
  mass_kg: number;
  liftHeight_m: number;
}

/** Weight of the load, `m g`, in newtons. */
function weight_N(lift: Lift): number {
  return lift.mass_kg * G_MPS2;
}

/** Lifting speed `v = P / (m g)`, in m/s. */
export function liftSpeed(lift: Lift): number {
  return lift.power_W / weight_N(lift);
}

/** Time to reach the top, `t_subida = m g H / P`, in seconds. */
export function riseTime(lift: Lift): number {
  return (weight_N(lift) * lift.liftHeight_m) / lift.power_W;
}

/** Height of the load at `t_s`, `h(t) = min(v t, H)`, in metres; a negative time is the start. */
export function heightAt(lift: Lift, t_s: number): number {
  return Math.min(liftSpeed(lift) * Math.max(t_s, 0), lift.liftHeight_m);
}

/** Potential energy at `t_s`, `E_p = m g h(t)`, in joules (= `P t` while it rises). */
export function potentialEnergyAt(lift: Lift, t_s: number): number {
  return weight_N(lift) * heightAt(lift, t_s);
}

/** Potential energy at the top, `m g H`: the fixed scale of the energy bar, in joules. */
export function topEnergy(lift: Lift): number {
  return weight_N(lift) * lift.liftHeight_m;
}

/**
 * Work delivered by the motor, `W = P t`, in joules. The motor stops when the load reaches the
 * top, so the time is counted up to `t_subida` and the work never exceeds `m g H`.
 */
export function workAt(lift: Lift, t_s: number): number {
  return lift.power_W * Math.min(Math.max(t_s, 0), riseTime(lift));
}

/** Whether the load has reached the top at `t_s`. */
export function reachedTop(lift: Lift, t_s: number): boolean {
  return t_s >= riseTime(lift);
}
