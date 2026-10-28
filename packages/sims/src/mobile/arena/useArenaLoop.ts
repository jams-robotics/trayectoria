import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Track, WheelCommand } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { FREE_LAYOUT } from './freeArena';
import { createFreeRace, freeProgress, isFreeRace } from './freeRace';
import type { FreeProgress } from './freeRace';
import { createRace } from './race';
import type { Race, Racer } from './race';
import { createArenaScene } from './scene/arenaScene';
import type { ArenaScene, ScreenPoint } from './scene/arenaScene';
import { createTelemetry } from './telemetry';
import type { Telemetry } from './telemetry';
import { NOISE_SIGMA } from './useArenaSettings';
import type { ArenaSettings } from './useArenaSettings';

/** How often the HUD re-renders, in milliseconds: the scene itself runs at the frame rate. */
const SNAPSHOT_EVERY_MS = 100;
/** Width of a side panel plus its margin, in CSS pixels (`w-panel` + `left-4`), from `lg` up. */
const SIDE_PANEL_PX = 368;
const LG_PX = 1024;

/** Share of the canvas width the overview cameras can use: both side panels cover the rest. */
function freeFraction(width_px: number, panels: boolean): number {
  if (!panels || width_px < LG_PX) return 1;
  return Math.max((width_px - 2 * SIDE_PANEL_PX) / width_px, 0.35);
}

/** Seed of the run, the same as the 2D simulator's default (`DEFAULT_SEED`). */
const SEED = 7;

export interface ArenaSnapshot {
  readonly you: Racer;
  readonly ghost: Racer | null;
  /** Goals and stopwatch of the free arena; `null` on a track. */
  readonly free: FreeProgress | null;
}

export interface ArenaRefs {
  readonly root: RefObject<HTMLDivElement | null>;
  readonly canvas: RefObject<HTMLCanvasElement | null>;
  readonly youTag: RefObject<HTMLDivElement | null>;
  readonly ghostTag: RefObject<HTMLDivElement | null>;
}

export interface ArenaLoop {
  readonly snapshot: ArenaSnapshot | null;
  readonly running: boolean;
  readonly telemetry: Telemetry;
  readonly scene: RefObject<ArenaScene | null>;
  setRunning(running: boolean): void;
  reset(): void;
  kick(rad: number): void;
}

interface LoopInputs {
  readonly spec: RobotSpec;
  readonly track: Track;
  readonly settings: ArenaSettings;
  /** Wheel speeds of the manual mode, or `null` to let the controller drive. */
  readonly command: WheelCommand | null;
}

function placeTag(tag: HTMLDivElement | null, point: ScreenPoint): void {
  if (tag === null) return;
  tag.hidden = point === null;
  if (point !== null)
    tag.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -130%)`;
}

function newRace({ spec, track, settings }: LoopInputs): Race {
  if (settings.free) return createFreeRace(spec, FREE_LAYOUT);
  return createRace({
    spec,
    track,
    controller: settings.controller,
    params: settings.params[settings.controller],
    ghost: settings.ghost,
    rival: { controller: settings.rival, params: settings.rivalParams[settings.rival] },
    seed: SEED,
    ...(settings.noise ? { noiseSigma: NOISE_SIGMA } : {}),
  });
}

/** The race, rebuilt (paused at `t = 0`) whenever something that defines the run changes. */
function useRace(inputs: LoopInputs, epoch: number): Race {
  const { spec, settings } = inputs;
  const [race, setRace] = useState<{ key: string; race: Race } | null>(null);
  const key = JSON.stringify([
    spec.id,
    settings.track,
    settings.free,
    settings.controller,
    settings.ghost,
    settings.rival,
    // Any gain of the rival restarts the run, as its controller does: a rival tuned mid-race and
    // set back to the reference would otherwise leave a run no longer comparable.
    settings.rivalParams[settings.rival],
    settings.noise,
    epoch,
  ]);
  if (race === null || race.key !== key) {
    const next = newRace(inputs);
    setRace({ key, race: next });
    return next;
  }
  return race.race;
}

/** Sizes the scene to its canvas, leaving out the side panels when they show. */
function fitScene(scene: ArenaScene, canvas: HTMLCanvasElement, panels: boolean): void {
  scene.resize(canvas.clientWidth, canvas.clientHeight, freeFraction(canvas.clientWidth, panels));
}

/** Creates the three.js scene on the canvas and keeps it sized to its box. */
function useMountedScene(
  refs: ArenaRefs,
  panels: RefObject<boolean>,
): RefObject<ArenaScene | null> {
  const scene = useRef<ArenaScene | null>(null);
  useEffect(() => {
    const canvas = refs.canvas.current;
    const root = refs.root.current;
    if (canvas === null || root === null) return undefined;
    const created = createArenaScene(canvas, root);
    scene.current = created;
    const fit = (): void => fitScene(created, canvas, panels.current);
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();
    return () => {
      observer.disconnect();
      created.dispose();
      scene.current = null;
    };
  }, [refs.canvas, refs.root, panels]);
  return scene;
}

/** The scene, kept in step with the robot, the track and the camera of `inputs`. */
function useScene(refs: ArenaRefs, inputs: LoopInputs): RefObject<ArenaScene | null> {
  // Cinema hides the panels, so the overview framings get the whole width back.
  const panels = useRef(inputs.settings.camera !== 'cinema');
  panels.current = inputs.settings.camera !== 'cinema';
  const scene = useMountedScene(refs, panels);
  const { spec, track, settings } = inputs;
  const mobile = spec.mobile;
  useEffect(() => {
    // The free arena has no line: its robots carry no sensors.
    if (mobile !== undefined) scene.current?.setRobot(mobile, settings.ghost, !settings.free);
  }, [mobile, settings.ghost, settings.free, scene]);
  useEffect(() => {
    if (settings.free) scene.current?.setFree(FREE_LAYOUT);
    else scene.current?.setTrack(track);
  }, [track, settings.free, scene]);
  useEffect(() => {
    const canvas = refs.canvas.current;
    scene.current?.setCamera(settings.camera);
    if (canvas !== null && scene.current !== null) fitScene(scene.current, canvas, panels.current);
  }, [settings.camera, refs.canvas, scene]);
  return scene;
}

interface Live {
  race: Race;
  running: boolean;
  speed: number;
}

/** One animation frame after another: advances the race, records it and draws it. */
function useFrames(
  refs: ArenaRefs,
  live: RefObject<Live>,
  scene: RefObject<ArenaScene | null>,
  telemetry: Telemetry,
  onSnapshot: (snapshot: ArenaSnapshot) => void,
): void {
  useEffect(() => {
    let frame = 0;
    let last: number | null = null;
    let lastSnapshot = 0;
    const tick = (now: number): void => {
      const dt_s = last === null ? 0 : (now - last) / 1000;
      last = now;
      const { race, running, speed } = live.current;
      if (running) race.advance(dt_s * speed);
      telemetry.record(race.you);
      if (isFreeRace(race)) scene.current?.markGoals(race.collected, race.you.state.robot.t_s);
      const points = scene.current?.frame(race.you, race.ghost, Math.min(dt_s, 0.1));
      placeTag(refs.youTag.current, race.ghost === null ? null : (points?.you ?? null));
      placeTag(refs.ghostTag.current, points?.ghost ?? null);
      if (now - lastSnapshot > SNAPSHOT_EVERY_MS) {
        lastSnapshot = now;
        onSnapshot({ you: race.you, ghost: race.ghost, free: freeProgress(race) });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [refs.youTag, refs.ghostTag, live, scene, telemetry, onSnapshot]);
}

/**
 * Runs the arena: one animation frame advances the race by the elapsed time times the playback
 * speed, records the telemetry and draws the scene. The HUD gets a snapshot ten times a second.
 */
export function useArenaLoop(refs: ArenaRefs, inputs: LoopInputs): ArenaLoop {
  const [epoch, setEpoch] = useState(0);
  const race = useRace(inputs, epoch);
  const scene = useScene(refs, inputs);
  const [running, setRunning] = useState(true);
  const [snapshot, setSnapshot] = useState<ArenaSnapshot | null>(null);
  const telemetry = useRef(createTelemetry()).current;
  const live = useRef<Live>({ race, running, speed: inputs.settings.speed });
  live.current = { race, running, speed: inputs.settings.speed };
  race.setParams(inputs.settings.params[inputs.settings.controller]);
  race.setRivalParams(inputs.settings.rivalParams[inputs.settings.rival]);
  race.setCommand(inputs.command);

  useEffect(() => {
    telemetry.clear();
    scene.current?.clearTrails();
  }, [race, telemetry, scene]);
  useFrames(refs, live, scene, telemetry, setSnapshot);

  return {
    snapshot,
    running,
    telemetry,
    scene,
    setRunning,
    reset: () => setEpoch((value) => value + 1),
    kick: (rad) => race.kick(rad),
  };
}
