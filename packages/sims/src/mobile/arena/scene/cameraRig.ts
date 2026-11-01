import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { DiffDriveState } from '@trayectoria/sim-core';

import type { Bounds } from './trackMesh';

/** How the camera looks at the run. `orbit` is the only one the learner moves by hand. */
export type CameraMode = 'chase' | 'orbit' | 'top' | 'onboard' | 'cinema';

export const CAMERA_MODES: readonly CameraMode[] = ['chase', 'orbit', 'top', 'onboard', 'cinema'];

/** Fraction of the gap to the goal the camera closes per second (exponential smoothing). */
const FOLLOW_RATE = 4.5;
/** Closest the camera gets to a pair of robots, in metres. */
const PAIR_MIN_M = 1.1;
/** Angular speed of the cinema orbit, in rad/s. */
const CINEMA_RADPS = 0.25;

export interface CameraRig {
  readonly controls: OrbitControls;
  setMode(mode: CameraMode): void;
  setBounds(bounds: Bounds): void;
  /** Fraction of the canvas width left free by the side panels, for the overview framings. */
  setWidthFraction(fraction: number): void;
  /**
   * Moves the camera towards the goal of the current mode for `robot`; with `other` (two players)
   * the chase frames both robots instead.
   */
  update(robot: DiffDriveState, dt_s: number, other?: DiffDriveState): void;
}

interface Goal {
  readonly eye: Vector3;
  readonly target: Vector3;
}

function chaseGoal(robot: DiffDriveState, goal: Goal): void {
  const cos = Math.cos(robot.theta_rad);
  const sin = Math.sin(robot.theta_rad);
  goal.eye.set(robot.x_m - 0.55 * cos, robot.y_m - 0.55 * sin, 0.34);
  goal.target.set(robot.x_m + 0.3 * cos, robot.y_m + 0.3 * sin, 0);
}

/** Both robots in view from behind and above: the camera backs off as they drift apart. */
function pairGoal(
  state: RigState,
  camera: PerspectiveCamera,
  robots: readonly [DiffDriveState, DiffDriveState],
  goal: Goal,
): void {
  const [a, b] = robots;
  const bounds = {
    minX: Math.min(a.x_m, b.x_m),
    minY: Math.min(a.y_m, b.y_m),
    maxX: Math.max(a.x_m, b.x_m),
    maxY: Math.max(a.y_m, b.y_m),
  };
  const height_m = Math.max(fitDistance(bounds, camera, state.widthFraction), PAIR_MIN_M);
  centerOf(bounds, goal.target);
  goal.eye.set(goal.target.x, goal.target.y - height_m * 0.35, height_m);
}

function onboardGoal(robot: DiffDriveState, goal: Goal): void {
  const cos = Math.cos(robot.theta_rad);
  const sin = Math.sin(robot.theta_rad);
  goal.eye.set(robot.x_m + 0.12 * cos, robot.y_m + 0.12 * sin, 0.06);
  goal.target.set(robot.x_m + 0.5 * cos, robot.y_m + 0.5 * sin, 0);
}

/** Distance that fits `bounds` in a vertical field of view of `fov_deg`, with some room. */
function fitDistance(bounds: Bounds, camera: PerspectiveCamera, widthFraction: number): number {
  const width_m = bounds.maxX - bounds.minX + 0.4;
  const height_m = bounds.maxY - bounds.minY + 0.4;
  const half_rad = (camera.fov * Math.PI) / 360;
  const byHeight = height_m / 2 / Math.tan(half_rad);
  const byWidth = width_m / 2 / Math.tan(half_rad) / (camera.aspect * widthFraction);
  return Math.max(byHeight, byWidth);
}

function centerOf(bounds: Bounds, out: Vector3): Vector3 {
  return out.set((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0);
}

interface RigState {
  mode: CameraMode;
  bounds: Bounds;
  cinema_rad: number;
  widthFraction: number;
}

function initialState(): RigState {
  return {
    mode: 'chase',
    bounds: { minX: -0.5, minY: -0.5, maxX: 0.5, maxY: 0.5 },
    cinema_rad: 0,
    widthFraction: 1,
  };
}

function controlsFor(camera: PerspectiveCamera, element: HTMLElement): OrbitControls {
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, element);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.minDistance = 0.15;
  controls.maxDistance = 8;
  return controls;
}

/** Frames the whole track from above at an angle, for the orbit mode. */
function overview(state: RigState, camera: PerspectiveCamera, controls: OrbitControls): void {
  const distance_m = fitDistance(state.bounds, camera, state.widthFraction);
  centerOf(state.bounds, controls.target);
  camera.position.set(controls.target.x, controls.target.y - distance_m * 0.75, distance_m * 0.75);
  controls.update();
}

function goalFor(
  state: RigState,
  camera: PerspectiveCamera,
  goal: Goal,
  robot: DiffDriveState,
  dt_s: number,
  other: DiffDriveState | undefined,
): void {
  if (state.mode === 'chase' && other !== undefined) pairGoal(state, camera, [robot, other], goal);
  else if (state.mode === 'chase') chaseGoal(robot, goal);
  else if (state.mode === 'onboard') onboardGoal(robot, goal);
  else if (state.mode === 'top') {
    centerOf(state.bounds, goal.target);
    const height_m = fitDistance(state.bounds, camera, state.widthFraction);
    goal.eye.set(goal.target.x, goal.target.y - height_m * 0.12, height_m);
  } else {
    state.cinema_rad += CINEMA_RADPS * dt_s;
    goal.target.set(robot.x_m, robot.y_m, 0.02);
    goal.eye.set(
      robot.x_m + 0.55 * Math.cos(state.cinema_rad),
      robot.y_m + 0.55 * Math.sin(state.cinema_rad),
      0.22,
    );
  }
}

export function createCameraRig(camera: PerspectiveCamera, element: HTMLElement): CameraRig {
  const controls = controlsFor(camera, element);
  const state = initialState();
  const goal: Goal = { eye: new Vector3(), target: new Vector3() };
  const lookAt = new Vector3();
  const reframe = (): void => {
    if (state.mode === 'orbit') overview(state, camera, controls);
  };

  return {
    controls,
    setMode(next) {
      state.mode = next;
      controls.enabled = next === 'orbit';
      reframe();
    },
    setWidthFraction(fraction) {
      state.widthFraction = fraction;
      reframe();
    },
    setBounds(next) {
      state.bounds = next;
      reframe();
    },
    update(robot, dt_s, other) {
      if (state.mode === 'orbit') {
        controls.update();
        return;
      }
      goalFor(state, camera, goal, robot, dt_s, other);
      // The onboard camera is rigid: smoothing it would make the robot seem to drift under it.
      const k = state.mode === 'onboard' ? 1 : 1 - Math.exp(-FOLLOW_RATE * dt_s);
      camera.position.lerp(goal.eye, k);
      lookAt.lerp(goal.target, k);
      camera.lookAt(lookAt);
    },
  };
}
