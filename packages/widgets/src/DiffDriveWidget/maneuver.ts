/**
 * The three-move maneuver of `DiffDriveWidget` (docs/WIDGETS.md, DiffDriveWidget; #394,
 * decision C; T-5.5): turn in place, drive straight, undo the turn. The phase comes from the
 * simulated time of the state, never from a clock of its own, and every phase change falls on
 * its exact instant: the step that contains it is split in two.
 */
import { createDiffDriveModel, degToRad, inverseKinematics } from '@trayectoria/sim-core';
import type { DiffDriveState, Model, Twist, WheelCommand } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

/** The `maneuver` prop of `DiffDriveWidget`, as docs/WIDGETS.md declares it. */
export interface Maneuver {
  /** Initial value of the «Giro» slider, in degrees, counterclockwise positive. */
  turn_deg: number;
  /** Initial value of the «Avance» slider, in metres. */
  distance_m: number;
  /** Turning speed of phases 1 and 3; 1 rad/s when absent. */
  omega_radps?: number;
  /** Forward speed of phase 2; 0.2 m/s when absent. */
  v_mps?: number;
}

/** Ranges of docs/WIDGETS.md for the maneuver values. */
export const MANEUVER_TURN_RANGE_DEG = { min: -180, max: 180, step: 1 } as const;
export const MANEUVER_DISTANCE_RANGE_M = { min: 0, max: 0.5, step: 0.01 } as const;
const OMEGA_RANGE_RADPS = { min: 0.5, max: 5 } as const;
const V_RANGE_MPS = { min: 0.05, max: 0.6 } as const;
/** Default speeds of the maneuver (docs/WIDGETS.md). */
const DEFAULT_OMEGA_RADPS = 1;
const DEFAULT_V_MPS = 0.2;

/** The maneuver the model runs: the slider values with the fixed speeds of the prop. */
export interface ManeuverPlan {
  readonly turn_rad: number;
  readonly distance_m: number;
  readonly omega_radps: number;
  readonly v_mps: number;
}

/** Phases 1 (turn), 2 (advance) and 3 (undo the turn), or `done` once `t = T`. */
export type ManeuverPhase = 1 | 2 | 3 | 'done';

/** The null command the model gets once the maneuver is over. */
const STOPPED: WheelCommand = { omegaL_radps: 0, omegaR_radps: 0 };

function clamp(value: number, range: { readonly min: number; readonly max: number }): number {
  return Math.min(range.max, Math.max(range.min, value));
}

/** The plan of the current slider values and the fixed speeds of `maneuver`. */
export function planOf(maneuver: Maneuver, turn_deg: number, distance_m: number): ManeuverPlan {
  return {
    turn_rad: degToRad(clamp(turn_deg, MANEUVER_TURN_RANGE_DEG)),
    distance_m: clamp(distance_m, MANEUVER_DISTANCE_RANGE_M),
    omega_radps: clamp(maneuver.omega_radps ?? DEFAULT_OMEGA_RADPS, OMEGA_RANGE_RADPS),
    v_mps: clamp(maneuver.v_mps ?? DEFAULT_V_MPS, V_RANGE_MPS),
  };
}

/** `T₁ = T₃ = |turn|/ω` and `T₂ = d/v`, in seconds. */
export function phaseDurations_s(plan: ManeuverPlan): readonly [number, number, number] {
  const turn_s = Math.abs(plan.turn_rad) / plan.omega_radps;
  return [turn_s, plan.distance_m / plan.v_mps, turn_s];
}

/** `T = 2|turn|/ω + d/v`, in seconds. */
export function maneuverDuration_s(plan: ManeuverPlan): number {
  const [turn1_s, advance_s, turn2_s] = phaseDurations_s(plan);
  return turn1_s + advance_s + turn2_s;
}

/** Instants at which phases 1, 2 and 3 end, in seconds. */
function phaseEnds_s(plan: ManeuverPlan): readonly [number, number, number] {
  const [turn1_s, advance_s, turn2_s] = phaseDurations_s(plan);
  return [turn1_s, turn1_s + advance_s, turn1_s + advance_s + turn2_s];
}

/** The phase at `t_s`; a phase of duration 0 is skipped. */
export function phaseAt(plan: ManeuverPlan, t_s: number): ManeuverPhase {
  const [end1_s, end2_s, end3_s] = phaseEnds_s(plan);
  if (t_s < end1_s) return 1;
  if (t_s < end2_s) return 2;
  if (t_s < end3_s) return 3;
  return 'done';
}

/** The `(v, ω)` of a phase: turns at `±ω` with `v = 0`, the advance at `v` with `ω = 0`. */
export function phaseTwist(plan: ManeuverPlan, phase: ManeuverPhase): Twist {
  const turning_radps = Math.sign(plan.turn_rad) * plan.omega_radps;
  if (phase === 1) return { v_mps: 0, omega_radps: turning_radps };
  if (phase === 2) return { v_mps: plan.v_mps, omega_radps: 0 };
  if (phase === 3) return { v_mps: 0, omega_radps: -turning_radps };
  return { v_mps: 0, omega_radps: 0 };
}

/** The wheel commands of a phase: the inverse kinematics of its `(v, ω)`. */
export function phaseCommand(
  plan: ManeuverPlan,
  phase: ManeuverPhase,
  spec: MobileSpec,
): WheelCommand {
  if (phase === 'done') return STOPPED;
  const twist = phaseTwist(plan, phase);
  return inverseKinematics(twist.v_mps, twist.omega_radps, spec);
}

/**
 * Advances `state` by `dt_s` along the maneuver, splitting the step at every phase change it
 * contains, so the pose does not depend on the integration step or on the frames.
 */
function maneuverStep(
  ideal: Model<DiffDriveState, WheelCommand>,
  plan: ManeuverPlan,
  spec: MobileSpec,
  state: DiffDriveState,
  dt_s: number,
): DiffDriveState {
  const to_s = state.t_s + dt_s;
  let next = state;
  let from_s = state.t_s;
  for (const cut_s of [...phaseEnds_s(plan), to_s]) {
    if (cut_s <= from_s) continue;
    const end_s = Math.min(cut_s, to_s);
    const command = phaseCommand(plan, phaseAt(plan, (from_s + end_s) / 2), spec);
    // The time is set to the cut itself, so the float sum of the pieces never drifts from it.
    next = { ...ideal.step(next, command, end_s - from_s), t_s: end_s };
    from_s = end_s;
    if (end_s === to_s) break;
  }
  return next;
}

/** The spec without `maxAccel_radps2`: the ideal kinematics of T-5.5, with no ramp. */
function withoutRamp(spec: MobileSpec): MobileSpec {
  const ideal = { ...spec };
  delete ideal.maxAccel_radps2;
  return ideal;
}

/**
 * The model of sim-core wrapped with the maneuver: with a plan in `plan.current` it ignores the
 * slider command and runs the sequence without the `maxAccel_radps2` ramp; with `null` it is the
 * model of sim-core as it was. The ref is read on every step, so no rebuild is needed.
 */
export function maneuverModel(
  spec: MobileSpec,
  plan: { readonly current: ManeuverPlan | null },
): Model<DiffDriveState, WheelCommand> {
  const ramped = createDiffDriveModel(spec);
  const ideal = createDiffDriveModel(withoutRamp(spec));
  return {
    init: (seed) => ramped.init(seed),
    step: (state, input, dt_s) =>
      plan.current === null
        ? ramped.step(state, input, dt_s)
        : maneuverStep(ideal, plan.current, spec, state, dt_s),
  };
}
