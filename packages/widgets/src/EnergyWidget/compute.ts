/**
 * Pure work, energy and power of `EnergyWidget` (docs/WIDGETS.md, EnergyWidget;
 * docs/CURRICULUM.md T-3.1 and T-3.2). Closed form only: `E_k = ½ m v²`, `E_p = m g h`,
 * `W = F d cosθ`, `W_neto = ΔE_k`, `h_max = v²/2g`, `P = τ ω`, `P = F v`, `P_el = V I`,
 * `P_mec = η P_el` and `t = C/P`. `g` comes from `sim-core` (#90, decision 1); the dynamics of
 * the ramp live in `model.ts`, which integrates them with `rk4`.
 */
import { G_MPS2, rpmToRadps } from '@trayectoria/sim-core';

/** Which of the two situations of T-3.1 and T-3.2 the widget shows (docs/WIDGETS.md). */
export type EnergyMode = 'ramp' | 'power';

/** How many motors the electrical block adds up (#90, decision 6). */
export type MotorCount = 1 | 2;

/** The ramp as the learner edits it, as `WIDGETS.md` declares its `initial`. */
export interface Ramp {
  mass_kg: number;
  v0_mps: number;
  slope_rad: number;
  mu_k: number;
}

/** The mechanical block of `power`: `P = τ ω`, with `ω` edited in rpm (#90, decision 6). */
export interface Mechanical {
  torque_Nm: number;
  n_rpm: number;
}

/** The electrical block of `power`: `P_el = motors · V I`, `η` and the battery (decision 6). */
export interface Electrical {
  voltage_V: number;
  current_A: number;
  efficiency: number;
  motors: MotorCount;
  battery_Wh: number;
}

/** Minutes in an hour, to turn the autonomy of `C/P` hours into minutes (T-3.2). */
const MIN_PER_H = 60;

export { G_MPS2, rpmToRadps };

/** Kinetic energy in joules: `E_k = ½ m v²` (T-3.1). */
export function kineticEnergy(mass_kg: number, v_mps: number): number {
  return 0.5 * mass_kg * v_mps * v_mps;
}

/** Gravitational potential energy in joules: `E_p = m g h` (T-3.1). */
export function potentialEnergy(mass_kg: number, height_m: number): number {
  return mass_kg * G_MPS2 * height_m;
}

/** Work of a constant force in joules: `W = F d cosθ`, with `θ` in radians (T-3.1). */
export function work(force_N: number, distance_m: number, angle_rad = 0): number {
  return force_N * distance_m * Math.cos(angle_rad);
}

/** Net work to take a mass from rest to `v`: `W_neto = ΔE_k` (T-3.1). */
export function netWork(mass_kg: number, v0_mps: number, v1_mps: number): number {
  return kineticEnergy(mass_kg, v1_mps) - kineticEnergy(mass_kg, v0_mps);
}

/** Height a body reaches by inertia with no friction: `h_max = v²/2g` (T-3.1). */
export function maxHeight(v_mps: number): number {
  return (v_mps * v_mps) / (2 * G_MPS2);
}

/** Mechanical power in watts of a turning shaft: `P = τ ω` (T-3.2). */
export function shaftPower(torque_Nm: number, omega_radps: number): number {
  return torque_Nm * omega_radps;
}

/** Mechanical power in watts of a force along the motion: `P = F v` (T-3.2). */
export function linearPower(force_N: number, v_mps: number): number {
  return force_N * v_mps;
}

/** Electrical power in watts of `motors` identical motors: `P_el = motors · V I` (T-3.2). */
export function electricalPower(
  voltage_V: number,
  current_A: number,
  motors: MotorCount = 1,
): number {
  return motors * voltage_V * current_A;
}

/** Mechanical power in watts the motors deliver: `P_mec = η P_el` (T-3.2, decision 6). */
export function mechanicalPower(electrical_W: number, efficiency: number): number {
  return efficiency * electrical_W;
}

/** Autonomy in minutes of a battery of `C` Wh at `P` W: `t = C/P` hours (T-3.2). */
export function autonomy_min(battery_Wh: number, power_W: number): number {
  if (power_W <= 0) return Number.POSITIVE_INFINITY;
  return (battery_Wh / power_W) * MIN_PER_H;
}

/** The four readings of the mechanical block, all derived from `τ` and `n` (decision 6). */
export interface MechanicalReadout {
  omega_radps: number;
  power_W: number;
}

/** `ω = n·2π/60` and `P = τ ω` of the mechanical block (T-3.2, decision 6). */
export function readMechanical({ torque_Nm, n_rpm }: Mechanical): MechanicalReadout {
  const omega_radps = rpmToRadps(n_rpm);
  return { omega_radps, power_W: shaftPower(torque_Nm, omega_radps) };
}

/** The readings of the electrical block: `P_el`, `P_mec` and the autonomy (decision 6). */
export interface ElectricalReadout {
  electrical_W: number;
  mechanical_W: number;
  autonomy_min: number;
}

/** `P_el = motors·V I`, `P_mec = η P_el` and `t = C/P_el · 60` (T-3.2, decision 6). */
export function readElectrical({
  voltage_V,
  current_A,
  efficiency,
  motors,
  battery_Wh,
}: Electrical): ElectricalReadout {
  const electrical_W = electricalPower(voltage_V, current_A, motors);
  return {
    electrical_W,
    mechanical_W: mechanicalPower(electrical_W, efficiency),
    autonomy_min: autonomy_min(battery_Wh, electrical_W),
  };
}
