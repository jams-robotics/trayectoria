import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { parseTrack, presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { useMyRobot } from '@trayectoria/widgets';

import { ControllerPanel } from './ControllerPanel';
import { CONTROLLERS, isControllerId } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';
import { LineFollowerView } from './LineFollowerView';
import type { StartPoseControl } from './LineFollowerView';
import type { StartPose } from './StartPoseHandle';
import { useLineFollower } from './useLineFollower';
import type { LineFollowerApi } from './useLineFollower';

/** Preset names the widget accepts, as `docs/WIDGETS.md` spells them. */
export type TrackPreset = 'oval' | 's' | 'tight' | 'cross';

/**
 * A track given as data: the serialized JSON of `parseTrack` (F1-04) or a `Track` already
 * parsed, which is what an editor of F4-01 hands over without a round trip through a string.
 */
export type TrackJson = string | Track;

/** Plots `showPlots` may ask for; drawn from F4-03 on (docs/WIDGETS.md). */
export type LineFollowerPlot = 'error' | 'v' | 'omega' | 'pid';

const PRESET_TRACKS: Readonly<Record<TrackPreset, Track>> = {
  oval: presets.oval,
  s: presets.sCurve,
  tight: presets.tightCurves,
  cross: presets.crossing,
};

function isPreset(track: LineFollowerWidgetProps['track']): track is TrackPreset {
  return typeof track === 'string' && Object.hasOwn(PRESET_TRACKS, track);
}

/**
 * The track the widget simulates. A preset name resolves to the track of sim-core, a string is
 * parsed with `parseTrack` and an object is taken as it is; a string that does not parse falls
 * back to the oval rather than leaving the widget without a track.
 */
export function resolveTrack(track: LineFollowerWidgetProps['track']): Track {
  if (isPreset(track)) return PRESET_TRACKS[track];
  if (typeof track !== 'string') return track;
  const result = parseTrack(track);
  return result.ok ? result.value : presets.oval;
}

/**
 * Which controller drives the run and with which gains; a new tab resets them to its defaults.
 * A gain alone changes only `params`, which `useLineFollower` hands to the running controller.
 */
function useControllerChoice(
  controller: LineFollowerWidgetProps['controller'],
  initialParams: ControllerParams,
): {
  selected: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
} {
  const [selected, setSelected] = useState<ControllerId>(() =>
    isControllerId(controller) ? controller : 'pid',
  );
  const [params, setParams] = useState<ControllerParams>(() => ({
    ...CONTROLLERS[controller].defaults,
    ...initialParams,
  }));
  return {
    selected,
    params,
    onController: (id) => {
      setSelected(id);
      setParams({ ...CONTROLLERS[id].defaults });
    },
    onParam: (key, value) => {
      setParams((current) => ({ ...current, [key]: value }));
    },
  };
}

/**
 * The controller selector and its sliders. Without `renderPanel` it is the side column of
 * F4-02a; with it, the wrapper the page supplies decides the placement.
 */
function Panel({
  spec,
  controller,
  params,
  onController,
  onParam,
  renderPanel,
}: {
  spec: RobotSpec;
  controller: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
  renderPanel: ((panel: ReactNode) => ReactNode) | undefined;
}): JSX.Element | null {
  const { mobile } = spec;
  if (mobile === undefined) return null;
  const content = (
    <ControllerPanel
      controller={controller}
      params={params}
      spec={mobile}
      onController={onController}
      onParam={onParam}
    />
  );
  // With `renderPanel` the page decides where the panel goes and how wide it is (F4-02b: la
  // maqueta 04 lo pone en su propia columna, no junto al visor), so the widget adds no column of
  // its own; without it the panel keeps the side column of F4-02a.
  if (renderPanel !== undefined) return <>{renderPanel(content)}</>;
  return <div className="flex flex-col gap-4 lg:w-80">{content}</div>;
}

/**
 * Publishes the live api to `onApi`, so a page can drive and read the run from outside.
 *
 * The api object is rebuilt on every render — `useSimulationDriver` hands back a fresh one each
 * time — so reporting it by identity would loop: the page stores it, the store re-renders the
 * widget, and the widget reports another fresh object. It is therefore reported only when
 * something a consumer can observe actually changed: the state of the model, whether the run is
 * going and at what speed.
 */
function useApiReport(
  api: LineFollowerApi,
  onApi: ((api: LineFollowerApi) => void) | undefined,
): void {
  const latest = useRef(api);
  latest.current = api;
  const { state, driver } = api;
  // La traza no entra: `useLineFollower` la reconstruye en un efecto propio, así que durante una
  // carrera rápida cada muestra publicaría una api nueva y el consumidor volvería a renderizar el
  // widget en cadena. Quien quiera la traza la tiene en la api que recibe; lo que dispara el aviso
  // es el estado del modelo, que ya cambia en cada tick.
  useEffect(() => {
    onApi?.(latest.current);
  }, [onApi, state, driver.running, driver.speed]);
}

export interface LineFollowerWidgetProps {
  /**
   * Preset of sim-core, serialized track or `Track` (docs/WIDGETS.md). `TrackJson` already
   * admits any string, so a preset name is one of its values rather than a separate arm.
   */
  track: TrackJson;
  /** Controller the widget opens on; every tab of the selector stays reachable. */
  controller: 'onoff' | 'p' | 'pid';
  /** Starting value of the sliders; whatever it omits comes from the controller defaults. */
  initialParams: ControllerParams;
  /** Robot simulated; «Mi robot» of the learner when it is not given. */
  robot?: RobotSpec;
  /** Hides the controller panel and the legend, for an embedded viewer. */
  compact?: boolean;
  /**
   * Plots to draw beside the viewer. Accepted so the content can already declare them, but it
   * has no effect until F4-03 adds the charts (fuera de alcance de #127).
   */
  showPlots?: LineFollowerPlot[];
  /** Standard deviation of the sensor noise; without it the readings are exact. */
  noiseSigma?: number;
  /**
   * Pose the run starts from (F4-02b, #128, decisión 2). Without it the robot starts at the
   * beginning of the track, exactly as in F4-02a. Changing it rebuilds the simulation, so the
   * run restarts at `t = 0`, which is what the spec asks of a new start pose.
   */
  startPose?: StartPose;
  /**
   * Called with the pose the learner drops the start handle on, or types into the `s_m` field
   * (F4-02b). Passing it is what makes the handle appear; without it the viewer draws no marker.
   */
  onStartPoseChange?: (pose: StartPose) => void;
  /**
   * Called with the live `LineFollowerApi` (F4-02b): the driver and the state of the run. It is
   * what lets a page put the playback controls in its own bottom bar and show the lap counter in
   * an accordion summary, without reimplementing the simulation.
   */
  onApi?: (api: LineFollowerApi) => void;
  /**
   * Wraps the controller panel, so a page can put it in an accordion in móvil (F4-02b; mismo
   * patrón que `renderPanel` de `ArmViewer`). Without it the panel renders as it always has.
   */
  renderPanel?: (panel: ReactNode) => ReactNode;
  /**
   * Hides `SimControls` under the viewer, so a page can put them in its fixed bottom bar
   * (F4-02b, docs/DESIGN.md §9.7). Without it the controls stay where F4-02a put them.
   */
  hideControls?: boolean;
}

/**
 * The line-following simulator (docs/WIDGETS.md, LineFollowerWidget): a track, a robot driven by
 * the controller the learner picks, the viewer of `docs/DESIGN.md` §6 and the playback controls.
 * It is the same component the page `/simuladores/movil` will embed with `compact` (F4-02b).
 *
 * Moving a gain or the base speed applies to the run in progress without pausing it, so the
 * learner sees the response change as it happens (#161). Picking another controller restarts the
 * run at `t = 0`, paused: the new tab also resets its sliders to their own defaults, so there is
 * no state of a previous law to splice into.
 */
/**
 * The start-pose control, only while the page asks for it: `startPose` alone would leave a
 * marker nobody can move, so both props are needed (#128, decisión 3).
 */
function handleOf(
  startPose: StartPose | undefined,
  onStartPoseChange: ((pose: StartPose) => void) | undefined,
): StartPoseControl | undefined {
  if (startPose === undefined || onStartPoseChange === undefined) return undefined;
  return { pose: startPose, onStartPoseChange };
}

/** The viewer column: `LineFollowerView` with the start-pose control when there is one. */
function Viewer({
  api,
  spec,
  track,
  compact,
  hideControls,
  handle,
}: {
  api: LineFollowerApi;
  spec: RobotSpec;
  track: Track;
  compact: boolean;
  hideControls: boolean;
  handle: StartPoseControl | undefined;
}): JSX.Element {
  return (
    <LineFollowerView
      api={api}
      spec={spec}
      track={track}
      compact={compact}
      hideControls={hideControls}
      {...(handle === undefined ? {} : { startPose: handle })}
    />
  );
}

/** The robot, the resolved track, the controller choice and the live run of one widget. */
function useRun(props: LineFollowerWidgetProps): {
  spec: RobotSpec;
  resolved: Track;
  choice: ReturnType<typeof useControllerChoice>;
  api: LineFollowerApi;
} {
  const { track, controller, initialParams, robot, noiseSigma, startPose, onApi } = props;
  // «Mi robot» is the default, so a saved change reaches the simulator with no reload; an
  // explicit `robot` still wins, which is what the stories use.
  const myRobot = useMyRobot();
  const spec = robot ?? myRobot;
  const resolved = useMemo(() => resolveTrack(track), [track]);
  const choice = useControllerChoice(controller, initialParams);
  const api = useLineFollower({
    spec,
    track: resolved,
    controller: choice.selected,
    params: choice.params,
    ...(noiseSigma === undefined ? {} : { noiseSigma }),
    ...(startPose === undefined ? {} : { startPose }),
  });
  useApiReport(api, onApi);
  return { spec, resolved, choice, api };
}

export function LineFollowerWidget(props: LineFollowerWidgetProps): JSX.Element {
  const { compact = false, hideControls = false, renderPanel } = props;
  const { spec, resolved, choice, api } = useRun(props);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start" data-testid="line-follower">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Viewer
          api={api}
          spec={spec}
          track={resolved}
          compact={compact}
          hideControls={hideControls}
          handle={handleOf(props.startPose, props.onStartPoseChange)}
        />
      </div>
      {compact ? null : (
        <Panel
          spec={spec}
          controller={choice.selected}
          params={choice.params}
          onController={choice.onController}
          onParam={choice.onParam}
          renderPanel={renderPanel}
        />
      )}
    </div>
  );
}
