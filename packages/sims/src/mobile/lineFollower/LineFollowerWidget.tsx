import { useEffect, useMemo, useRef } from 'react';
import type { JSX, ReactNode, RefObject } from 'react';
import type { Track } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { useMyRobot } from '@trayectoria/widgets';

import { useManualMode } from './ManualControls';
import type { ManualDrive } from './useManualKeyboard';
import { useControllerChoice } from './ControllerPanel';
import { ControllerColumn, ViewerColumn } from './columns';
import type { ControllerParams } from './controllers';
import { Instruments } from './Instruments';
import { LineFollowerView } from './LineFollowerView';
import type { StartPoseControl } from './LineFollowerView';
import type { LineFollowerPlot } from './plots';
import { resolveTrack } from './tracks';
import type { TrackJson } from './tracks';
import { useInstruments } from './useInstruments';
import type { Instruments as LiveInstruments } from './useInstruments';
import type { StartPose } from './StartPoseHandle';
import { useLineFollower } from './useLineFollower';
import type { LineFollowerApi } from './useLineFollower';

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
   * Plots drawn under the viewer (F4-03, #129, decisión 6): `error`, `v`, `omega` and, with the
   * PID selected, `pid` with its three terms. Without the prop none is drawn, which is exactly
   * how the widget behaved in F4-02a.
   */
  showPlots?: LineFollowerPlot[];
  /** Stacks the plots at 120 px each instead of 200 (docs/DESIGN.md §9 punto 8). */
  mobile?: boolean;
  /**
   * Called with the live instrumentation of the run (F4-03): the lap timer and the pose the line
   * was lost at, so a page can put the plots in a panel of its own.
   */
  onInstruments?: (instruments: LiveInstruments) => void;
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
   * Wraps the viewer column, so a page can decide what surrounds it — e.g. swapping it for a
   * track editor without reaching into the widget's DOM (#158, enmienda tras auditoría de PR
   * #169; mismo patrón que `renderPanel`). Without it the viewer renders where it always has.
   */
  renderViewer?: (viewer: ReactNode) => ReactNode;
  /**
   * Hides `SimControls` under the viewer, so a page can put them in its fixed bottom bar
   * (F4-02b, docs/DESIGN.md §9.7). Without it the controls stay where F4-02a put them.
   */
  hideControls?: boolean;
  /**
   * Semilla del generador de ruido (F4-05, #131, decisión 3). Sin ella la carrera usa la de
   * siempre; es la que viaja en el enlace compartido, y cambiarla reconstruye la simulación
   * pausada en `t = 0`, igual que cambiar de pista o de robot.
   */
  seed?: number;
}

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
  instruments,
}: {
  api: LineFollowerApi;
  spec: RobotSpec;
  track: Track;
  compact: boolean;
  hideControls: boolean;
  handle: StartPoseControl | undefined;
  instruments: LiveInstruments;
}): JSX.Element {
  return (
    <LineFollowerView
      api={api}
      spec={spec}
      track={track}
      compact={compact}
      hideControls={hideControls}
      instruments={instruments}
      {...(handle === undefined ? {} : { startPose: handle })}
    />
  );
}

/** Space over the viewer plays or pauses the run (#130, decisión 2; docs/DESIGN.md §5). */
function togglePlayOf(api: LineFollowerApi): () => void {
  return () => {
    if (api.driver.running) api.driver.pause();
    else api.driver.play();
  };
}

/** The robot, the resolved track, the controller choice and the live run of one widget. */
function useRun(
  props: LineFollowerWidgetProps,
  viewerRef: RefObject<HTMLDivElement | null>,
): {
  spec: RobotSpec;
  resolved: Track;
  choice: ReturnType<typeof useControllerChoice>;
  api: LineFollowerApi;
  drive: ManualDrive;
  manual: boolean;
} {
  const { track, controller, initialParams, robot, noiseSigma, startPose, seed, onApi } = props;
  // «Mi robot» is the default, so a saved change reaches the simulator with no reload; an
  // explicit `robot` still wins, which is what the stories use.
  const myRobot = useMyRobot();
  const spec = robot ?? myRobot;
  const resolved = useMemo(() => resolveTrack(track), [track]);
  const choice = useControllerChoice(controller, initialParams);
  const manual = choice.selected === 'manual';
  // F4-04 (#130, decisión 2): the keyboard drives the robot while the manual tab is the one
  // selected, and the run is the one already on screen — the command is an input of each step,
  // not a reason to rebuild the simulation.
  const playRef = useRef<() => void>(() => undefined);
  const drive = useManualMode(viewerRef, { spec, enabled: manual, onTogglePlay: () => { playRef.current(); } });
  const api = useLineFollower({
    spec,
    track: resolved,
    controller: choice.selected,
    params: choice.params,
    ...(noiseSigma === undefined ? {} : { noiseSigma }),
    ...(startPose === undefined ? {} : { startPose }),
    ...(manual ? { command: drive.command } : {}),
    ...(seed === undefined ? {} : { seed }),
  });
  playRef.current = togglePlayOf(api);
  useApiReport(api, onApi);
  return { spec, resolved, choice, api, drive, manual };
}

/**
 * Publishes the live instrumentation to `onInstruments` (F4-03), on the same terms as
 * `useApiReport`: only when the timer or the lost pose actually change, so a page that re-renders
 * the widget on every publication does not loop.
 */
function useInstrumentsReport(
  instruments: LiveInstruments,
  onInstruments: ((instruments: LiveInstruments) => void) | undefined,
): void {
  const latest = useRef(instruments);
  latest.current = instruments;
  const { timer, lostAt } = instruments;
  useEffect(() => {
    onInstruments?.(latest.current);
  }, [onInstruments, timer, lostAt]);
}

/**
 * The line-following simulator (docs/WIDGETS.md, LineFollowerWidget): a track, a robot driven by
 * the controller the learner picks, the viewer of `docs/DESIGN.md` §6, the playback controls and,
 * with `showPlots`, the live charts of F4-03.
 *
 * Moving a gain or the base speed applies to the run in progress without pausing it (#161).
 * Picking another controller restarts the run at `t = 0`, paused.
 */
export function LineFollowerWidget(props: LineFollowerWidgetProps): JSX.Element {
  const { compact = false, hideControls = false, renderPanel, renderViewer } = props;
  const { showPlots, mobile = false, onInstruments } = props;
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const { spec, resolved, choice, api, drive, manual } = useRun(props, viewerRef);
  const pid = choice.selected === 'pid';
  const instruments = useInstruments({ api, track: resolved, params: choice.params, pid });
  useInstrumentsReport(instruments, onInstruments);

  const viewer = (
    <ViewerColumn
      viewerRef={viewerRef}
      manual={manual}
      drive={drive}
      viewer={
        <Viewer
          {...{ api, spec, compact, hideControls, instruments }}
          track={resolved}
          handle={handleOf(props.startPose, props.onStartPoseChange)}
        />
      }
      plots={
        showPlots === undefined ? null : (
          <Instruments buffers={instruments.buffers} show={showPlots} mobile={mobile} pid={pid} />
        )
      }
    />
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start" data-testid="line-follower">
      {renderViewer === undefined ? (
        <div className="flex min-w-0 flex-1 flex-col gap-3">{viewer}</div>
      ) : (
        <>{renderViewer(viewer)}</>
      )}
      {compact ? null : <ControllerColumn spec={spec} choice={choice} renderPanel={renderPanel} />}
    </div>
  );
}
