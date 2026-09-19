import { useMemo } from 'react';
import type { JSX } from 'react';
import { Simulation, createDiffDriveModel, oval, readLineArray } from '@trayectoria/sim-core';
import type { DiffDriveState, WheelCommand } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';
import { useT } from '@trayectoria/i18n';

import { SimControls } from '../SimControls';
import { Scene2D } from './Scene2D';
import { createFrameClock, useSimulationDriver } from './useSimulationDriver';
import { Axes } from './primitives/Axes';
import { Circle } from './primitives/Circle';
import { Grid } from './primitives/Grid';
import { Label } from './primitives/Label';
import { Rect } from './primitives/Rect';
import { Trace } from './primitives/Trace';
import { RobotBody } from './primitives/RobotBody';
import { TrackLayer } from './primitives/TrackLayer';
import { Vector } from './primitives/Vector';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'Scene2D', order: ['Primitives', 'OffCentre', 'RobotOnTrack'] };

/** A quarter-turn arc the robot would leave behind, sampled every 5°. */
const TRACE_POINTS_M: ReadonlyArray<readonly [number, number]> = Array.from(
  { length: 19 },
  (_unused, index) => {
    const angle_rad = (index * Math.PI) / 36;
    return [-0.7 + 0.45 * Math.cos(angle_rad), -0.3 + 0.45 * Math.sin(angle_rad)] as const;
  },
);

/**
 * Every primitive of the ticket in one scene: grid, axes, two vectors, a trace, a circle, a
 * rectangle and a label. This is the case captured in `Scene2D.png`.
 */
export function Primitives(): JSX.Element {
  const t = useT();
  return (
    <Scene2D worldWidth_m={2} description={t('widgets.Scene2D.primitives')}>
      <Grid />
      <Axes />
      <Trace points_m={TRACE_POINTS_M} />
      <Rect center_m={[0.55, -0.25]} width_m={0.34} height_m={0.2} angle_rad={0.35} filled />
      <Circle center_m={[-0.25, 0.28]} radius_m={0.12} filled />
      <Vector to_m={[0.45, 0.3]} label={t('widgets.Scene2D.vectorVelocity')} />
      <Vector
        from_m={[0.45, 0.3]}
        to_m={[0.72, 0.06]}
        color="color-vector-force"
        label={t('widgets.Scene2D.vectorForce')}
      />
      <Label at_m={[-0.7, -0.3]} text={t('widgets.Scene2D.traceLabel')} />
    </Scene2D>
  );
}

/** An off-centre, square view of the same trace: `center_m` and `aspect` away from their defaults. */
export function OffCentre(): JSX.Element {
  const t = useT();
  return (
    <Scene2D
      worldWidth_m={1.2}
      center_m={[-0.7, -0.3]}
      aspect={1}
      description={t('widgets.Scene2D.offCentre')}
    >
      <Grid step_m={0.1} />
      <Axes />
      <Trace points_m={TRACE_POINTS_M} />
      <Circle center_m={[-0.7, -0.3]} radius_m={0.45} />
      <Label at_m={[-0.7, -0.3]} text={t('widgets.Scene2D.traceLabel')} />
    </Scene2D>
  );
}

/** Reference robot of docs/ROBOT-SPEC.md §3, the default of «Mi robot». */
const REFERENCE = referenceMobile as RobotSpec;
const REFERENCE_MOBILE = REFERENCE.mobile as MobileSpec;

/** Fixed step of the demo simulation, in seconds. */
const DT_S = 0.002;

/**
 * Unequal wheel speeds, so the kinematics of sim-core trace an arc rather than a straight line
 * (#85, decision 6). Both are well inside the saturation limit of the reference robot.
 */
const ARC_COMMAND: WheelCommand = { omegaL_radps: 6, omegaR_radps: 9 };

/** View that keeps the whole oval preset visible, in metres. */
const TRACK_VIEW_WIDTH_M = 1.6;
const TRACK_VIEW_CENTRE_M: [number, number] = [0.3, 0.25];

/** Analog reading above which a sensor counts as «sees the line» for the drawing. */
const SENSOR_ON_THRESHOLD = 0.5;

/**
 * The reference robot driven over the `oval` preset by the differential-drive model of sim-core:
 * the widget owns no kinematics of its own, only the drawing. Captured paused at `t = 0` in
 * `Scene2D-robot.png`.
 */
export function RobotOnTrack(): JSX.Element {
  const t = useT();
  const { sim, clock } = useMemo(() => {
    const frameClock = createFrameClock();
    return {
      sim: new Simulation<DiffDriveState, WheelCommand>(createDiffDriveModel(REFERENCE_MOBILE), {
        dt_s: DT_S,
        seed: 0,
        clock: frameClock,
        input: ARC_COMMAND,
      }),
      clock: frameClock,
    };
  }, []);
  const driver = useSimulationDriver(sim, { clock });
  const pose = driver.state;
  const sensorStates = readLineArray(oval, pose, REFERENCE_MOBILE).values.map(
    (value) => value >= SENSOR_ON_THRESHOLD,
  );

  return (
    <div className="flex flex-col gap-3">
      <Scene2D
        worldWidth_m={TRACK_VIEW_WIDTH_M}
        center_m={TRACK_VIEW_CENTRE_M}
        description={t('widgets.Scene2D.robotOnTrack')}
      >
        <Grid />
        <TrackLayer track={oval} />
        <RobotBody
          spec={REFERENCE}
          pose={{ x_m: pose.x_m, y_m: pose.y_m, theta_rad: pose.theta_rad }}
          sensorStates={sensorStates}
        />
      </Scene2D>
      <SimControls {...driver} />
    </div>
  );
}
