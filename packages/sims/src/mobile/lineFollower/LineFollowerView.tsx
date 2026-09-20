import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { DEFAULT_LOST_THRESHOLD, binarize, pointAt, trackLength_m } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { Circle, RobotBody, Scene2D, SimControls, Trace, TrackLayer } from '@trayectoria/widgets';

import { LapCard } from './LapCard';
import type { Instruments } from './useInstruments';
import { StartPoseHandle, StartPoseMarker } from './StartPoseHandle';
import type { StartPose } from './StartPoseHandle';
import type { LineFollowerApi } from './useLineFollower';
import type { LineFollowerState, Pose } from './model';

/** Margin left around the track on every side, in metres (#127, decisión 6). */
const VIEW_MARGIN_M = 0.1;

/** Narrowest world width the compact viewer shows, in metres (#127, decisión 6). */
const COMPACT_MIN_WIDTH_M = 1;

/** Samples of the centerline used to bound the view; one every centimetre is plenty. */
const BOUNDS_STEP_M = 0.01;

/**
 * Visible aspect (width / height) the enclosing `Scene2D` draws with. It mirrors the default of
 * `Scene2D` (`packages/widgets/src/Scene2D/Scene2D.tsx`, `DEFAULT_ASPECT`), which the widgets
 * package does not export, so a track taller than `worldWidth_m / VIEW_ASPECT` is not cropped
 * (#157, decisiones 1 y 2).
 */
const VIEW_ASPECT = 16 / 9;

/** Decimals of the sensor readings in the legend (#127, decisión 6). */
const READING_DECIMALS = 2;

/** Decimals of the pose, speed and time readouts of the legend. */
const READOUT_DECIMALS = 3;

/**
 * The visible world of a track: its extent plus `VIEW_MARGIN_M` on every side, widened so the
 * vertical extent also fits the aspect the scene draws with (#157, decisión 1).
 */
export function viewOf(
  track: Track,
  compact: boolean,
  aspect = VIEW_ASPECT,
): { worldWidth_m: number; center_m: [number, number] } {
  const length_m = trackLength_m(track);
  let minX_m = Number.POSITIVE_INFINITY;
  let maxX_m = Number.NEGATIVE_INFINITY;
  let minY_m = Number.POSITIVE_INFINITY;
  let maxY_m = Number.NEGATIVE_INFINITY;
  const count = length_m <= 0 ? 1 : Math.ceil(length_m / BOUNDS_STEP_M);
  for (let k = 0; k < count; k += 1) {
    const [x_m, y_m] = pointAt(track, k * BOUNDS_STEP_M);
    minX_m = Math.min(minX_m, x_m);
    maxX_m = Math.max(maxX_m, x_m);
    minY_m = Math.min(minY_m, y_m);
    maxY_m = Math.max(maxY_m, y_m);
  }
  if (!Number.isFinite(minX_m)) return { worldWidth_m: COMPACT_MIN_WIDTH_M, center_m: [0, 0] };
  const width_m = Math.max(
    maxX_m - minX_m + 2 * VIEW_MARGIN_M,
    (maxY_m - minY_m + 2 * VIEW_MARGIN_M) * aspect,
  );
  return {
    worldWidth_m: compact ? Math.max(width_m, COMPACT_MIN_WIDTH_M) : width_m,
    center_m: [(minX_m + maxX_m) / 2, (minY_m + maxY_m) / 2],
  };
}

/** One sensor per index: true where the reading reaches the lost threshold of sim-core. */
function sensorStates(state: LineFollowerState): readonly boolean[] {
  return binarize(state.reading.values, DEFAULT_LOST_THRESHOLD).map((bit) => bit === 1);
}

/** The live readings of the array, mono `xs` (docs/DESIGN.md §6: leyenda arriba-izquierda). */
function SensorLegend({ state, t }: { state: LineFollowerState; t: Translate }): JSX.Element {
  return (
    <p
      className="text-fg-muted font-mono text-xs tabular-nums"
      data-testid="line-follower-legend"
      role="status"
      aria-live="off"
    >
      <span>{t('sims.lineFollower.sensors')}</span>{' '}
      {state.reading.values.map((value, index) => (
        <span key={index} className="ml-2">
          {value.toFixed(READING_DECIMALS)}
        </span>
      ))}
    </p>
  );
}

/** Pose, twist, laps and time, all read off the model state (spec of #127). */
function Readouts({ state, t }: { state: LineFollowerState; t: Translate }): JSX.Element {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ['x', `${state.robot.x_m.toFixed(READOUT_DECIMALS)} m`],
    ['y', `${state.robot.y_m.toFixed(READOUT_DECIMALS)} m`],
    ['theta', `${state.robot.theta_rad.toFixed(READOUT_DECIMALS)} rad`],
    ['v', `${state.robot.v_mps.toFixed(READOUT_DECIMALS)} m/s`],
    ['omega', `${state.robot.omega_radps.toFixed(READOUT_DECIMALS)} rad/s`],
    ['laps', String(state.laps)],
    ['t', `${state.robot.t_s.toFixed(READING_DECIMALS)} s`],
  ];
  return (
    <dl
      className="text-fg-muted grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs tabular-nums"
      data-testid="line-follower-readouts"
    >
      {rows.map(([key, value]) => (
        <div key={key} className="contents">
          <dt>{t(`sims.lineFollower.readout.${key}`)}</dt>
          <dd data-testid={`line-follower-${key}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The warning shown while the array no longer sees the line (docs/DESIGN.md §8: no solo color). */
function LostNotice({ lost, t }: { lost: boolean; t: Translate }): JSX.Element | null {
  if (!lost) return null;
  return (
    <p className="text-error text-sm" role="alert" data-testid="line-follower-lost">
      {t('sims.lineFollower.lost')}
    </p>
  );
}

/** Radius of the marker drawn where the line was lost, in metres (F4-03, #129, decisión 5). */
const LOST_MARKER_RADIUS_M = 0.03;

/**
 * The marker left at the pose the array lost the line at (F4-03, decisión 5): a filled circle in
 * `--color-error`, which is the token docs/DESIGN.md §6 gives the error state. It stays until
 * «Reiniciar» starts the run over, so the learner can see where the robot went off.
 */
function LostMarker({ pose }: { pose: Pose | undefined }): JSX.Element | null {
  if (pose === undefined) return null;
  return (
    <Circle center_m={[pose.x_m, pose.y_m]} radius_m={LOST_MARKER_RADIUS_M} color="color-error" filled />
  );
}

/**
 * The assertive warning of the lost event (F4-03, decisión 5). It is a separate live region from
 * `LostNotice`: that one only describes the state of the array, while this one announces the run
 * stopping, which is what a screen reader has to hear the moment it happens.
 */
function LostEventNotice({ lost, t }: { lost: boolean; t: Translate }): JSX.Element {
  return (
    <p className="text-error text-sm" role="alert" aria-live="assertive" data-testid="instruments-lost">
      {lost ? t('sims.instruments.lineLost') : ''}
    </p>
  );
}

/**
 * The draggable start pose (F4-02b, #128): the pose the marker sits at and the callback the drop
 * publishes. Absent, the viewer draws no marker and behaves exactly as in F4-02a.
 */
export interface StartPoseControl {
  readonly pose: StartPose;
  readonly onStartPoseChange: (pose: StartPose) => void;
}

export interface LineFollowerViewProps {
  readonly api: LineFollowerApi;
  readonly spec: RobotSpec;
  readonly track: Track;
  /** Hides the legend and the readouts, for an embedded viewer (docs/WIDGETS.md). */
  readonly compact?: boolean;
  /** Draggable start pose over the track (F4-02b); without it nothing changes. */
  readonly startPose?: StartPoseControl;
  /** Hides `SimControls`, so a page can put them in its own bar (F4-02b, docs/DESIGN.md §9.7). */
  readonly hideControls?: boolean;
  /**
   * The live instrumentation of the run (F4-03, #129): the lap timer the card shows and the pose
   * the line was lost at. Without it the viewer draws neither, exactly as in F4-02b.
   */
  readonly instruments?: Instruments;
}

/**
 * Viewer of the line follower (docs/DESIGN.md §6): the track, the robot with its sensor dots,
 * the trace it has left behind, the playback controls and — outside `compact` — the live
 * readings of the array and the pose, twist, lap and time readouts. It owns no state: every
 * number it prints comes from the model state the hook publishes.
 */
/** The scene itself: track, trace, the start marker when there is one, and the robot. */
function Viewer({
  api,
  spec,
  track,
  view,
  marker,
  instruments,
  t,
}: {
  api: LineFollowerApi;
  spec: RobotSpec;
  track: Track;
  view: ReturnType<typeof viewOf>;
  marker: ReactNode;
  instruments: Instruments | undefined;
  t: Translate;
}): JSX.Element {
  const { robot } = api.state;
  // F4-03 (#129, decisión 5): la tarjeta de vuelta va abajo-derecha del visor (docs/DESIGN.md §6),
  // superpuesta a la escena; el envoltorio `relative` es lo que la ancla a esa esquina.
  return (
    <div className="relative">
      <Scene2D
        worldWidth_m={view.worldWidth_m}
        center_m={view.center_m}
        description={t('sims.lineFollower.scene')}
      >
        <TrackLayer track={track} />
        <Trace points_m={api.trace_m} />
        {marker}
        <LostMarker pose={instruments?.lostAt} />
        <RobotBody
          spec={spec}
          pose={{ x_m: robot.x_m, y_m: robot.y_m, theta_rad: robot.theta_rad }}
          sensorStates={sensorStates(api.state)}
        />
      </Scene2D>
      {instruments === undefined ? null : <LapCard timer={instruments.timer} />}
    </div>
  );
}

export function LineFollowerView({
  api,
  spec,
  track,
  compact = false,
  startPose,
  hideControls = false,
  instruments,
}: LineFollowerViewProps): JSX.Element {
  const t = useT();
  const view = viewOf(track, compact);
  const scene = (marker: ReactNode): JSX.Element => (
    <Viewer {...{ api, spec, track, view, marker, instruments, t }} />
  );
  return (
    <div className="flex flex-col gap-3" data-testid="line-follower-view">
      {startPose === undefined ? (
        scene(null)
      ) : (
        <StartPoseHandle
          track={track}
          pose={startPose.pose}
          onStartPoseChange={startPose.onStartPoseChange}
          view={view}
        >
          {(dragPose) => scene(<StartPoseMarker pose={dragPose} />)}
        </StartPoseHandle>
      )}
      {hideControls ? null : <SimControls {...api.driver} compact={compact} />}
      {instruments === undefined ? null : (
        <LostEventNotice lost={instruments.lostAt !== undefined} t={t} />
      )}
      <Below state={api.state} compact={compact} t={t} />
    </div>
  );
}

/** The warning, the sensor legend and the readouts under the viewer. */
function Below({
  state,
  compact,
  t,
}: {
  state: LineFollowerState;
  compact: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <LostNotice lost={state.lineLost} t={t} />
      {compact ? null : (
        <>
          <SensorLegend state={state} t={t} />
          <Readouts state={state} t={t} />
        </>
      )}
    </>
  );
}
