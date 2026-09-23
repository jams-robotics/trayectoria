import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';

import { useMyRobot } from '../MyRobotWidget/useMyRobot';
import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimControls } from '../SimControls/SimControls';
import { LiveStatus } from '../shared/ReadoutPanel';
import {
  forwardKinematics,
  inverseKinematics,
  mobileOf,
  saturate,
} from './compute';
import type { DiffDriveMode, DiffDriveShow, Pose, WheelCommand } from './compute';
import {
  Notice,
  OdometryPanel,
  PosePanel,
  applyCalibration,
  applyTheta,
  applyTwist,
  applyWheel,
  calibrationParams,
  readDiffDrive,
  statusOf,
  twistParams,
  wheelParams,
} from './panels';
import type { Readout, TwistInput } from './panels';
import { calibrationOf } from './odometry';
import type { Calibration } from './odometry';
import { odometryStatusOf } from './rows';
import { DiffDriveScene } from './scene';
import { useTimeline } from './timeline';
import type { Timeline } from './timeline';
import { useOdometry } from './useOdometry';
import type { Odometry } from './useOdometry';

export type { DiffDriveMode, DiffDriveShow } from './compute';

/** Seconds the animation runs before it pauses on its own (#92, decision 3). */
const DEFAULT_DURATION_S = 10;

export interface DiffDriveWidgetProps {
  mode: DiffDriveMode;
  /** Robot simulated; «Mi robot» of the learner when it is not given (#95, decision 6). */
  robot?: RobotSpec;
  show: DiffDriveShow[];
  initial: {
    omegaL_radps?: number;
    omegaR_radps?: number;
    v_mps?: number;
    omega_radps?: number;
  };
  duration_s?: number;
  /** Time the widget opens at, in seconds. Defaults to the start of the run. */
  initialTime_s?: number;
}

/** The wheel commands the widget starts from, in either mode (docs/WIDGETS.md, `initial`). */
function initialCommand(initial: DiffDriveWidgetProps['initial']): WheelCommand {
  return {
    omegaL_radps: initial.omegaL_radps ?? 0,
    omegaR_radps: initial.omegaR_radps ?? 0,
  };
}

/** The twist the widget starts from in `inverse` (docs/WIDGETS.md, `initial`). */
function initialTwist(initial: DiffDriveWidgetProps['initial']): TwistInput {
  return { v_mps: initial.v_mps ?? 0, omega_radps: initial.omega_radps ?? 0 };
}

/** The viewer column: the scene and the playback controls. */
function Viewer({
  scene,
  timeline,
}: {
  scene: JSX.Element;
  timeline: Timeline;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      {scene}
      <SimControls {...timeline.driver} {...timeline.controls} t_s={timeline.t_s} />
    </div>
  );
}

/** The sliders of the mode, with the saturation notice above them (#92, decision 4). */
function Sliders({
  params,
  onChange,
  feasible,
  t,
}: {
  params: ReturnType<typeof wheelParams>;
  onChange: (key: string, value: number) => void;
  feasible: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {feasible ? null : <Notice text={t('widgets.DiffDriveWidget.saturated')} tone="error" />}
      <ParamPanel params={params} onChange={onChange} />
    </div>
  );
}

/** What the scene draws of the estimation: the estimated pose and its trace (#93, decision 3). */
function sceneOdometry(
  odometry: Odometry | null,
): { pose: Pose; trace_m: ReadonlyArray<readonly [number, number]> } | undefined {
  if (odometry === null) return undefined;
  return { pose: odometry.estimated, trace_m: odometry.trace_m };
}

/** Drags the chassis to set `x, y`; absent while the simulation runs (#92, decision 6). */
function dragHandler(
  timeline: Timeline,
): ((point_m: readonly [number, number]) => void) | undefined {
  if (timeline.driver.running) return undefined;
  return (point_m) => {
    timeline.setPose((current) => ({ ...current, x_m: point_m[0], y_m: point_m[1] }));
  };
}

/** Turns the `θ` slider of the pose panel into a pose change (#92, decision 6). */
function thetaHandler(timeline: Timeline): (value_deg: number) => void {
  return (value_deg) => {
    timeline.setPose((current) => applyTheta(current, value_deg));
  };
}

/** The odometry panel and its live description; nothing outside `mode: 'odometry'`. */
function OdometryReadouts({
  odometry,
  real,
  t,
}: {
  odometry: Odometry | null;
  real: Pose;
  t: Translate;
}): JSX.Element | null {
  if (odometry === null) return null;
  return (
    <>
      <OdometryPanel odometry={odometry} real={real} t={t} />
      <LiveStatus text={odometryStatusOf(odometry, real, t)} />
    </>
  );
}

/** The whole right-hand column: the pose panel, the live description and the sliders. */
function Panels({
  mode,
  readout,
  spec,
  show,
  timeline,
  params,
  onSlider,
  odometry,
  t,
}: {
  mode: DiffDriveMode;
  readout: Readout;
  spec: MobileSpec;
  show: readonly DiffDriveShow[];
  timeline: Timeline;
  params: ReturnType<typeof wheelParams>;
  onSlider: (key: string, value: number) => void;
  odometry: Odometry | null;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4 lg:w-panel">
      <PosePanel
        mode={mode}
        readout={readout}
        spec={spec}
        withFrames={show.includes('frames')}
        onTheta={thetaHandler(timeline)}
        t={t}
      />
      <OdometryReadouts odometry={odometry} real={readout.pose} t={t} />
      <LiveStatus text={statusOf(readout, t)} />
      <Sliders params={params} onChange={onSlider} feasible={readout.feasible} t={t} />
    </div>
  );
}

/**
 * The wheel commands the model is fed, the sliders of the mode and their handler: `forward`
 * edits the two wheels directly and `inverse` derives them from `v, ω` with the inverse
 * kinematics of sim-core (#92, decisions 1 and 4).
 */
function useCommand(
  mode: DiffDriveMode,
  initial: DiffDriveWidgetProps['initial'],
  spec: MobileSpec,
  t: Translate,
): {
  command: WheelCommand;
  params: ReturnType<typeof wheelParams>;
  onSlider: (key: string, value: number) => void;
  calibration: Calibration;
} {
  const [wheels, setWheels] = useState<WheelCommand>(() => initialCommand(initial));
  const [twist, setTwist] = useState<TwistInput>(() => initialTwist(initial));
  const [calibration, setCalibration] = useState<Calibration>(() => calibrationOf(spec));
  const inverse = mode === 'inverse';
  const params = inverse ? twistParams(twist, spec, t) : wheelParams(wheels, spec, t);
  return {
    command: inverse ? inverseKinematics(twist.v_mps, twist.omega_radps, spec) : wheels,
    params:
      mode === 'odometry' ? [...params, ...calibrationParams(calibration, t)] : params,
    onSlider: (key, value) => {
      if (inverse) setTwist((current) => applyTwist(current, key, value));
      else setWheels((current) => applyWheel(current, key, value));
      if (mode === 'odometry') {
        setCalibration((current) => applyCalibration(current, key, value));
      }
    },
    calibration,
  };
}

/**
 * Mini simulator of the differential-drive robot (docs/WIDGETS.md, DiffDriveWidget;
 * docs/CURRICULUM.md T-5.1 to T-5.4): two wheel speeds or a `v, ω` pair drive the model of
 * sim-core, and the scene shows the ICR, the turning radius, the two reference frames, the
 * trace and an arrow per wheel.
 *
 * `mode: 'odometry'` adds the estimated pose: the encoders of sim-core are read at every step
 * and integrated with the calibration the learner believes, so both poses and both traces are
 * on screen with their errors beside them (T-5.4; #93, decision 3).
 */
export function DiffDriveWidget({
  mode,
  robot,
  show,
  initial,
  duration_s = DEFAULT_DURATION_S,
  initialTime_s = 0,
}: DiffDriveWidgetProps): JSX.Element {
  const t = useT();
  // «Mi robot» is the default, so a saved change reaches the simulator with no reload
  // (#95, decision 6); an explicit `robot` still wins, which is what the stories use.
  const myRobot = useMyRobot();
  const applicable = robot ?? myRobot;
  const spec = useMemo(() => mobileOf(applicable), [applicable]);
  const { command, params, onSlider, calibration } = useCommand(mode, initial, spec, t);
  const applied = saturate(command, spec);
  const timeline = useTimeline(spec, applied, duration_s, initialTime_s);
  const twist = forwardKinematics(applied.omegaL_radps, applied.omegaR_radps, spec);
  const readout = readDiffDrive(timeline.pose, command, twist, spec);
  const estimator = useOdometry(timeline.state, timeline.preroll, calibration);
  const odometry = mode === 'odometry' ? estimator : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Viewer
        timeline={timeline}
        scene={
          <DiffDriveScene
            {...{ spec, twist, command, show, t }}
            robot={applicable}
            pose={timeline.pose}
            feasible={readout.feasible}
            trace_m={timeline.trace_m}
            onDrag={dragHandler(timeline)}
            odometry={sceneOdometry(odometry)}
          />
        }
      />
      <Panels {...{ mode, readout, spec, show, timeline, params, onSlider, odometry, t }} />
    </div>
  );
}
