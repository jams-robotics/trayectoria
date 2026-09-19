/**
 * Gear ratios, output speed and torque of `GearWidget` (docs/WIDGETS.md, GearWidget;
 * docs/CURRICULUM.md T-4.4). Closed form only: `i = z2/z1 = n1/n2`, `τ_2 = τ_1 i η`,
 * `i_total = i_1 i_2` and `P_2 = P_1 η`. The rpm conversions come from `sim-core`
 * (#91, decision 1: no new dependencies, nothing converted outside `units.ts`).
 */
import { radpsToRpm, rpmToRadps } from '@trayectoria/sim-core';

/** How many meshed pairs the train has (docs/WIDGETS.md, GearWidget). */
export type GearStages = 1 | 2;

/** The train as the learner edits it, as `WIDGETS.md` declares its `initial`. */
export interface Train {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  nIn_rpm: number;
  torqueIn_Nm: number;
  efficiency: number;
}

/**
 * Module of every gear, in metres: the pitch radius is `r = m z / 2`, so a tooth count is a
 * radius and the drawing stays proportional to `z` (#91, decision 3).
 */
export const MODULE_M = 0.002;

/** Ratio of one meshed pair: `i = z_out/z_in` (T-4.4). Teeth are never zero in the panel. */
export function stageRatio(zIn: number, zOut: number): number {
  if (zIn === 0) return 0;
  return zOut / zIn;
}

/** Ratio of the whole train: one pair, or the product of both (`i_total = i_1 i_2`, T-4.4). */
export function totalRatio(stages: GearStages, train: Train): number {
  const first = stageRatio(train.z1, train.z2);
  if (stages === 1) return first;
  return first * stageRatio(train.z3, train.z4);
}

/** Ratio read from the speeds instead of the teeth: `i = n_1/n_2` (T-4.4). */
export function ratioFromSpeeds(nIn_rpm: number, nOut_rpm: number): number {
  if (nOut_rpm === 0) return Number.POSITIVE_INFINITY;
  return nIn_rpm / nOut_rpm;
}

/** Output speed in rpm: `n_out = n_in / i` (T-4.4). */
export function outputSpeed_rpm(stages: GearStages, train: Train): number {
  const ratio = totalRatio(stages, train);
  if (ratio === 0) return 0;
  return train.nIn_rpm / ratio;
}

/**
 * Sign of the output rotation relative to the input: each meshed pair reverses it, so one
 * stage turns the output backwards and two stages turn it the same way as the input (T-4.4).
 */
export function outputSign(stages: GearStages): number {
  return stages === 1 ? -1 : 1;
}

/** Output angular speed in rad/s, already signed by the number of meshed pairs (T-4.4). */
export function outputOmega_radps(stages: GearStages, train: Train): number {
  return outputSign(stages) * rpmToRadps(outputSpeed_rpm(stages, train));
}

/** Output torque in N·m: `τ_out = τ_in i η` (T-4.4). */
export function outputTorque_Nm(stages: GearStages, train: Train): number {
  return train.torqueIn_Nm * totalRatio(stages, train) * train.efficiency;
}

/** Mechanical power in watts of a shaft: `P = τ ω`, with `ω` from the speed in rpm. */
export function shaftPower_W(torque_Nm: number, n_rpm: number): number {
  return torque_Nm * rpmToRadps(n_rpm);
}

/** Input power in watts: the torque and speed the motor delivers (T-4.4). */
export function inputPower_W(train: Train): number {
  return shaftPower_W(train.torqueIn_Nm, train.nIn_rpm);
}

/** Output power in watts: `P_2 = P_1 η`, the losses of the train (T-4.4). */
export function outputPower_W(train: Train): number {
  return inputPower_W(train) * train.efficiency;
}

/** Pitch radius of a gear, in metres: `r = m z / 2` (#91, decision 3). */
export function pitchRadius_m(z: number): number {
  return (MODULE_M * z) / 2;
}

/** Angular speed of each shaft, in rad/s, signed: the input, the middle pair and the output. */
export interface ShaftSpeeds {
  /** Input gear `z1`, taken as positive. */
  omega1_radps: number;
  /** Driven gear `z2`, which carries `z3` on its shaft in a two stage train. */
  omega2_radps: number;
  /** Output gear `z4`; equal to `omega2_radps` when the train has a single stage. */
  omega4_radps: number;
}

/** The signed speed of every shaft of the train, from `n_in` and the teeth (T-4.4). */
export function shaftSpeeds(stages: GearStages, train: Train): ShaftSpeeds {
  const omega1_radps = rpmToRadps(train.nIn_rpm);
  const omega2_radps = -omega1_radps / Math.max(stageRatio(train.z1, train.z2), Number.EPSILON);
  if (stages === 1) return { omega1_radps, omega2_radps, omega4_radps: omega2_radps };
  const omega4_radps = -omega2_radps / Math.max(stageRatio(train.z3, train.z4), Number.EPSILON);
  return { omega1_radps, omega2_radps, omega4_radps };
}

/** Angle of a gear at `t_s`, in radians: `θ = ω t`, no ramp (T-4.4 runs at constant speed). */
export function angleAt(omega_radps: number, t_s: number): number {
  return omega_radps * t_s;
}

export { radpsToRpm, rpmToRadps };
