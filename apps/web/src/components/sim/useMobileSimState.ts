import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ControllerParams,
  SimConfig,
  StartPose,
  TrackJson,
  TrackPreset,
} from '@trayectoria/sims';
import type { RobotSpec } from '@trayectoria/widgets';

import { MY_ROBOT_ID } from './RobotSource';
import { useSimView } from './useSimView';
import type { SimView } from './useSimView';

// F4-02b (#128): state of `/simuladores/movil`, split from the presentation of
// `MobileSimIsland.tsx` to keep each file under the limit of docs/STANDARDS.md §4.

/** Preset the page opens with (ticket criterion: oval). */
export const DEFAULT_PRESET: TrackPreset = 'oval';

// F4-05 (#131, decisions 6 and 7): the controller, its parameters and the seed become page state,
// not only widget state: they are what «Guardar y compartir» writes into a `SimConfig` and
// what a `?c=` link applies again. The widget receives them as `controller`, `initialParams`
// and `seed`; `useControllerChoice` reads them on mount, so loading a configuration also changes
// `configKey`, and with it the widget's `key`, so that it adopts the new ones.

/**
 * Controller the widget opens with. `LineFollowerWidget` only accepts the three with a control
 * law in its `controller` prop; «Manual» is still a selector tab, but not a
 * value the page can start it with, so a configuration with `manual` opens with the
 * PID and the learner goes back to the manual tab with one click.
 */
export type PageController = 'onoff' | 'p' | 'pid';

/** Controller the page opens with (F4-02b criterion: PID). */
export const DEFAULT_CONTROLLER: PageController = 'pid';

/** Seed the page opens with; it is the widget's, and it travels in the shared link. */
export const DEFAULT_SEED = 7;

/** Whether the first render already happened in the browser. `useMediaQuery` queries `matchMedia`,
 * which does not exist on the server: this island is `client:visible` (#128, decision 1), so Astro
 * also renders it at build time and the first client render must match that one. Until it
 * mounts, the page is drawn with the desktop mockup, which is the one the server produced. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/** The effective track and the selector preset; the editor and «Cargar JSON» only change the track. */
export interface TrackChoice {
  readonly preset: TrackPreset;
  readonly track: TrackJson;
}

/**
 * The initial pose of a track: the start of the course while nobody drags the handle. It is
 * resolved with the module already loaded, so it returns `null` until `@trayectoria/sims` is
 * in memory; meanwhile the widget starts the robot where the track begins, which is the same.
 */
export async function initialPose(track: TrackJson): Promise<StartPose> {
  const { poseOnTrack, resolveTrack } = await import('@trayectoria/sims');
  return poseOnTrack(resolveTrack(track), null, 0);
}

export type { SimView };

/** The controller, its parameters and the seed of the run; what the link reproduces. */
export interface ControllerChoice {
  readonly controller: PageController;
  readonly params: ControllerParams;
  readonly seed: number;
}

/** What the island picks and publishes; a single object so as not to spread six `useState` over the view. */
export interface PageState {
  readonly robotId: string;
  readonly setRobotId: (id: string) => void;
  readonly robot: RobotSpec | null;
  readonly setRobot: (spec: RobotSpec) => void;
  readonly choice: TrackChoice;
  readonly startPose: StartPose | null;
  readonly setStartPose: (pose: StartPose) => void;
  readonly onTrack: (track: TrackJson) => void;
  readonly onPreset: (preset: TrackPreset) => void;
  readonly view: SimView;
  readonly openEditor: () => void;
  /** «Nueva pista»: opens the editor with a blank canvas (#190, decision 3). */
  readonly openNewEditor: () => void;
  readonly closeEditor: () => void;
  /** The track the editor opens with: the page's, or none after «Nueva pista». */
  readonly editorTrack: TrackJson | null;
  /** The controller, parameters and seed the widget starts with (F4-05). */
  readonly run: ControllerChoice;
  /** Changes with every applied configuration; it is the `key` that remounts the widget (F4-05). */
  readonly configKey: number;
  /** Applies a saved configuration or a link's one: track, controller, params and seed. */
  readonly applyConfig: (config: SimConfig) => void;
}

/** Applies the opening pose as soon as the simulator module is loaded. */
export function useOpeningPose(setStartPose: (pose: StartPose) => void): void {
  useEffect(() => {
    let live = true;
    void initialPose(DEFAULT_PRESET).then((pose) => {
      if (live) setStartPose(pose);
    });
    return () => {
      live = false;
    };
  }, [setStartPose]);
}

/**
 * The track of a `SimConfig`: the preset with its name or the editor's JSON. A `track` that is
 * neither of the two forms leaves the track as it is, which is what the page already showed.
 */
export function trackOf(config: SimConfig): TrackFromConfig | null {
  const { track } = config;
  if (typeof track === 'string') return { track };
  if (typeof track !== 'object' || track === null || !('preset' in track)) return null;
  const { preset } = track;
  const named = PRESETS.find((candidate) => candidate === preset);
  return named === undefined ? null : { preset: named, track: named };
}

/** The track that comes out of a configuration: the JSON, or the preset and its name. */
export interface TrackFromConfig {
  readonly preset?: TrackPreset;
  readonly track: TrackJson;
}

/** The four presets `LineFollowerWidget` resolves by name. */
const PRESETS: readonly TrackPreset[] = ['oval', 's', 'tight', 'cross'];

/** The chosen track and the two callbacks that change it (preset or editor JSON). */
function useTrackChoice(setStartPose: (pose: StartPose) => void): {
  choice: TrackChoice;
  setChoice: (update: (current: TrackChoice) => TrackChoice) => void;
  onTrack: (track: TrackJson) => void;
  onPreset: (preset: TrackPreset) => void;
} {
  const [choice, setChoice] = useState<TrackChoice>({
    preset: DEFAULT_PRESET,
    track: DEFAULT_PRESET,
  });

  // Changing the track restarts the simulation (the widget rebuilds it) and returns the initial pose
  // to the start of the new course: the previous track's one makes no sense on this one.
  const onTrack = useCallback(
    (track: TrackJson): void => {
      setChoice((current) => ({ ...current, track }));
      void initialPose(track).then(setStartPose);
    },
    [setStartPose],
  );

  const onPreset = useCallback((preset: TrackPreset): void => {
    setChoice((current) => ({ ...current, preset }));
  }, []);

  return { choice, setChoice, onTrack, onPreset };
}

/**
 * The controller, the parameters and the seed of the run, and how a loaded configuration changes
 * them (F4-05). `configKey` goes up with each one: it is the `key` with which the island remounts the
 * widget, because `useControllerChoice` reads the controller and the gains only on mount.
 */
function useRunChoice(applyTrack: (config: SimConfig) => void): {
  run: ControllerChoice;
  configKey: number;
  applyConfig: (config: SimConfig) => void;
} {
  const [run, setRun] = useState<ControllerChoice>({
    controller: DEFAULT_CONTROLLER,
    params: {},
    seed: DEFAULT_SEED,
  });
  const [configKey, setConfigKey] = useState(0);

  const applyConfig = useCallback(
    (config: SimConfig): void => {
      applyTrack(config);
      setRun({
        controller: config.controller === 'manual' ? DEFAULT_CONTROLLER : config.controller,
        params: config.params,
        seed: config.seed,
      });
      setConfigKey((current) => current + 1);
    },
    [applyTrack],
  );

  return { run, configKey, applyConfig };
}

/** The page state: the robot, the track, the initial pose and the running simulation. */
export function usePageState(): PageState {
  const [robotId, setRobotId] = useState(MY_ROBOT_ID);
  const [robot, setRobot] = useState<RobotSpec | null>(null);
  const [startPose, setStartPose] = useState<StartPose | null>(null);
  const { view, openEditor, openNewEditor, closeEditor, fromEmpty } = useSimView();
  const { choice, setChoice, onTrack, onPreset } = useTrackChoice(setStartPose);
  useOpeningPose(setStartPose);

  // Loading a configuration changes the track at once, without going through `onTrack`: the selector
  // preset and the effective track both come from the configuration.
  const applyTrack = useCallback(
    (config: SimConfig): void => {
      const resolved = trackOf(config);
      if (resolved === null) return;
      setChoice((current) => ({
        preset: resolved.preset ?? current.preset,
        track: resolved.track,
      }));
      void initialPose(resolved.track).then(setStartPose);
    },
    [setChoice],
  );
  const { run, configKey, applyConfig } = useRunChoice(applyTrack);

  return usePageStateObject({
    robotId,
    setRobotId,
    robot,
    setRobot,
    choice,
    startPose,
    setStartPose,
    onTrack,
    onPreset,
    view,
    openEditor,
    openNewEditor,
    closeEditor,
    // #190 (decision 3): «Nueva pista» opens the editor blank; «Editar esta pista», with the one
    // the page is simulating.
    editorTrack: fromEmpty ? null : choice.track,
    run,
    configKey,
    applyConfig,
  });
}

/**
 * The same object while nothing changes. The island's `renderPanel` depends on it, and a new one on
 * every render caused a loop (new `renderPanel` → the widget re-renders → `onApi` →
 * another object). The `set*` of `useState` and the `useCallback`s above are already stable.
 */
function usePageStateObject(state: PageState): PageState {
  const { robotId, robot, choice, startPose, onTrack, onPreset } = state;
  const { view, openEditor, openNewEditor, closeEditor, editorTrack } = state;
  const { run, configKey, applyConfig } = state;
  const kept = useRef(state);
  kept.current = state;
  return useMemo(
    () => ({ ...kept.current }),
    [
      robotId,
      robot,
      choice,
      startPose,
      onTrack,
      onPreset,
      view,
      openEditor,
      openNewEditor,
      closeEditor,
      editorTrack,
      run,
      configKey,
      applyConfig,
    ],
  );
}
