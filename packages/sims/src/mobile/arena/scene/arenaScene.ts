import {
  ACESFilmicToneMapping,
  BufferGeometry,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Track } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';

import type { FreeLayout } from '../freeArena';
import type { Racer } from '../race';
import { createCameraRig } from './cameraRig';
import type { CameraMode, CameraRig } from './cameraRig';
import { readPalette } from './palette';
import type { ArenaPalette } from './palette';
import { animateGoals, buildFree } from './freeMesh';
import { watchOwnModel } from '../model/ownModel';
import { buildRobot, disposeGroup } from './robotMesh';
import type { RobotMesh } from './robotMesh';
import { buildTrack } from './trackMesh';
import { createTrail } from './trail';
import type { Trail } from './trail';

/** Side of the dark floor around the mat, in metres. */
const FLOOR_M = 14;

/** Screen position of a robot, in CSS pixels of the canvas; `null` when behind the camera. */
export type ScreenPoint = { readonly x: number; readonly y: number } | null;

/** The robot next to the learner's: none, the translucent reference or player 2. */
export type SecondRobot = 'none' | 'ghost' | 'player';

export interface ArenaScene {
  readonly canvas: HTMLCanvasElement;
  setTrack(track: Track): void;
  /** Swaps the mat for the open floor of the free arena, with its cones and stars. */
  setFree(layout: FreeLayout): void;
  /** Hides the collected stars and spins the rest; `t_s` is the simulated time. */
  markGoals(collected: readonly boolean[], t_s: number): void;
  setRobot(spec: MobileSpec, second: SecondRobot, sensors: boolean): void;
  setCamera(mode: CameraMode): void;
  /** Draws the racers and moves the camera; returns where each robot is on screen. */
  frame(you: Racer, ghost: Racer | null, dt_s: number): { you: ScreenPoint; ghost: ScreenPoint };
  clearTrails(): void;
  /** Sizes the canvas; `freeFraction` is the share of its width not covered by side panels. */
  resize(width_px: number, height_px: number, freeFraction?: number): void;
  dispose(): void;
}

function stage(palette: ArenaPalette, renderer: WebGLRenderer): Scene {
  const scene = new Scene();
  scene.background = palette.floor.clone();
  scene.fog = new Fog(palette.floor, 4, 11);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(1.2, -1.6, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.5;
  key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 2.5;
  key.shadow.camera.bottom = -2.5;
  key.shadow.bias = -0.0004;
  scene.add(key, key.target, new HemisphereLight(palette.accent, palette.floor, 0.5));
  const floor = new Mesh(
    new PlaneGeometry(FLOOR_M, FLOOR_M),
    new MeshStandardMaterial({ color: palette.floor, roughness: 1 }),
  );
  floor.position.z = -0.002;
  floor.receiveShadow = true;
  const grid = new GridHelper(FLOOR_M, FLOOR_M * 4, palette.grid, palette.grid);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -0.001;
  scene.add(floor, grid);
  return scene;
}

function rendererFor(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

interface Actors {
  you: RobotMesh | null;
  ghost: RobotMesh | null;
  second: SecondRobot;
  track: Group | null;
  goals: readonly Group[];
}

function project(
  group: Group | undefined,
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  at: Vector3,
): ScreenPoint {
  if (group === undefined) return null;
  at.set(group.position.x, group.position.y, 0.09).project(camera);
  if (at.z > 1) return null;
  return { x: ((at.x + 1) / 2) * canvas.clientWidth, y: ((1 - at.y) / 2) * canvas.clientHeight };
}

/** Distance to the camera under which the ghost starts to fade, and where it is gone, in metres. */
const FADE_FROM_M = 0.8;
const FADE_TO_M = 0.4;

/** 1 far from the camera, 0 on top of it: the ghost never blocks the chase view. */
function fadeNear(camera: PerspectiveCamera, group: Group, at: Vector3): number {
  const distance_m = at.copy(group.position).distanceTo(camera.position);
  return Math.min(Math.max((distance_m - FADE_TO_M) / (FADE_FROM_M - FADE_TO_M), 0), 1);
}

/** Everything the arena keeps alive between frames. */
interface Stage {
  readonly canvas: HTMLCanvasElement;
  readonly palette: ArenaPalette;
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly rig: CameraRig;
  readonly actors: Actors;
  readonly trails: { you: Trail; ghost: Trail };
  readonly at: Vector3;
}

function stageFor(canvas: HTMLCanvasElement, root: Element): Stage {
  const palette = readPalette(root);
  const renderer = rendererFor(canvas);
  const scene = stage(palette, renderer);
  const camera = new PerspectiveCamera(50, 1, 0.01, 40);
  const trails = { you: createTrail(palette), ghost: createTrail(palette, palette.ghost) };
  scene.add(trails.you.mesh, trails.ghost.mesh);
  return {
    canvas,
    palette,
    renderer,
    scene,
    camera,
    rig: createCameraRig(camera, canvas),
    actors: { you: null, ghost: null, second: 'none', track: null, goals: [] },
    trails,
    at: new Vector3(),
  };
}

function replace(scene: Scene, old: { group: Group } | Group | null): void {
  if (old === null) return;
  const group = old instanceof Group ? old : old.group;
  scene.remove(group);
  disposeGroup(group);
}

function setTrack(s: Stage, track: Track): void {
  replace(s.scene, s.actors.track);
  s.actors.goals = [];
  const built = buildTrack(track, s.palette);
  s.actors.track = built.group;
  s.scene.add(built.group);
  s.rig.setBounds(built.bounds);
}

function setFree(s: Stage, layout: FreeLayout): void {
  replace(s.scene, s.actors.track);
  const built = buildFree(layout, s.palette);
  s.actors.track = built.group;
  s.actors.goals = built.goals;
  s.scene.add(built.group);
  s.rig.setBounds(built.bounds);
}

function setRobot(s: Stage, spec: MobileSpec, second: SecondRobot, sensors: boolean): void {
  replace(s.scene, s.actors.you);
  replace(s.scene, s.actors.ghost);
  s.actors.you = buildRobot(spec, s.palette, { sensors });
  s.actors.second = second;
  s.actors.ghost =
    second === 'none'
      ? null
      : buildRobot(spec, s.palette, { ghost: true, opaque: second === 'player', sensors });
  s.scene.add(s.actors.you.group);
  if (s.actors.ghost !== null) s.scene.add(s.actors.ghost.group);
}

function frame(
  s: Stage,
  you: Racer,
  ghost: Racer | null,
  dt_s: number,
): { you: ScreenPoint; ghost: ScreenPoint } {
  const { actors, trails, camera, at } = s;
  actors.you?.update(you.state.robot, you.state.reading);
  trails.you.push(
    you.state.robot.x_m,
    you.state.robot.y_m,
    Math.abs(you.state.reading.linePosition),
  );
  if (ghost !== null && actors.ghost !== null) {
    actors.ghost.update(ghost.state.robot, ghost.state.reading);
    if (actors.second === 'ghost') actors.ghost.fade(fadeNear(camera, actors.ghost.group, at));
    trails.ghost.push(ghost.state.robot.x_m, ghost.state.robot.y_m, 0);
  }
  s.rig.update(you.state.robot, dt_s, actors.second === 'player' ? ghost?.state.robot : undefined);
  s.renderer.render(s.scene, camera);
  return {
    you: project(actors.you?.group, camera, s.canvas, at),
    ghost: project(actors.ghost?.group, camera, s.canvas, at),
  };
}

function resize(s: Stage, width_px: number, height_px: number, freeFraction: number): void {
  s.renderer.setSize(width_px, height_px, false);
  s.camera.aspect = width_px / Math.max(height_px, 1);
  s.camera.updateProjectionMatrix();
  s.rig.setWidthFraction(freeFraction);
}

function dispose(s: Stage): void {
  s.rig.controls.dispose();
  s.scene.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    const geometry: unknown = child.geometry;
    if (geometry instanceof BufferGeometry) geometry.dispose();
  });
  s.renderer.dispose();
}

/**
 * The 3D arena: the dark floor, the mat with the line, the learner's robot, the reference ghost
 * and their trails. It only draws: the states come from `race.ts`.
 */
export function createArenaScene(canvas: HTMLCanvasElement, root: Element): ArenaScene {
  const s = stageFor(canvas, root);
  // The robot is rebuilt when the learner's own model changes (preview while adjusting).
  const last: { spec: MobileSpec | null; second: SecondRobot; sensors: boolean } = {
    spec: null,
    second: 'none',
    sensors: true,
  };
  const unwatch = watchOwnModel(() => {
    if (last.spec !== null) setRobot(s, last.spec, last.second, last.sensors);
  });
  return {
    canvas,
    setTrack: (track) => setTrack(s, track),
    setFree: (layout) => setFree(s, layout),
    markGoals: (collected, t_s) => animateGoals(s.actors.goals, collected, t_s),
    setRobot(spec, second, sensors) {
      last.spec = spec;
      last.second = second;
      last.sensors = sensors;
      setRobot(s, spec, second, sensors);
    },
    setCamera: (mode) => s.rig.setMode(mode),
    frame: (you, ghost, dt_s) => frame(s, you, ghost, dt_s),
    clearTrails() {
      s.trails.you.clear();
      s.trails.ghost.clear();
    },
    resize: (width_px, height_px, freeFraction = 1) => resize(s, width_px, height_px, freeFraction),
    dispose() {
      unwatch();
      dispose(s);
    },
  };
}
