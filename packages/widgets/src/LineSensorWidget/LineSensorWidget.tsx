import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { useMyRobot } from '../MyRobotWidget/useMyRobot';
import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimControls } from '../SimControls/SimControls';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { SimLayout } from '../shared/SimLayout';
import { lineSensorsOf, readSensorArray } from './compute';
import type { SensorArrayReading } from './compute';
import { SensorBars, applyChange, paramsOf, readoutRows, statusOf } from './panels';
import type { SliderInput } from './panels';
import { SensorScene } from './scene';
import { useWidgetTime } from './timeline';

/** Initial threshold `u` of the binary reading (docs/WIDGETS.md, LineSensorWidget). */
const INITIAL_THRESHOLD = 0.5;

export interface LineSensorWidgetProps {
  /** Robot whose `lineSensors` are read; «Mi robot» of the learner when it is not given. */
  robot?: RobotSpec;
  /** Initial lateral offset of the line at the array, in metres, positive to the left. */
  initialOffset_m: number;
  /** Initial angle of the line relative to the X axis of {R}, in radians. Defaults to 0. */
  initialAngle_rad?: number;
  /** Shows the binary reading `b_k` of each sensor. */
  showBinary?: boolean;
  /** Initial standard deviation of the reading noise, dimensionless. Defaults to 0. */
  noiseSigma?: number;
}

/** The right-hand column: bars, position values and the live sentence (docs/DESIGN.md §6). */
function Values({
  reading,
  showBinary,
  t,
}: {
  reading: SensorArrayReading;
  showBinary: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <SensorBars reading={reading} showBinary={showBinary} t={t} />
      <ReadoutPanel title={t('widgets.LineSensorWidget.panel')} rows={readoutRows(reading, t)} />
      <LiveStatus text={statusOf(reading, t)} />
    </>
  );
}

/**
 * The line sensor array over a straight stretch of line that the learner slides: readings
 * `v_k`, weighted index `k̄`, position `p`, offset `y_línea`, binary readings with threshold `u`
 * and the «línea perdida» warning (docs/WIDGETS.md, LineSensorWidget; CURRICULUM.md T-6.1).
 * The readings come from `readLineArray` of sim-core; the noise takes a new seeded sample
 * every 0.1 s of the widget time, which `SimControls` moves.
 */
export function LineSensorWidget({
  robot,
  initialOffset_m,
  initialAngle_rad = 0,
  showBinary = false,
  noiseSigma = 0,
}: LineSensorWidgetProps): JSX.Element {
  const t = useT();
  const myRobot = useMyRobot();
  const spec = useMemo(() => lineSensorsOf(robot ?? myRobot), [robot, myRobot]);
  const [sliders, setSliders] = useState<SliderInput>(() => ({
    offset_m: initialOffset_m,
    angle_rad: initialAngle_rad,
    noiseSigma,
    threshold: INITIAL_THRESHOLD,
  }));
  const driver = useWidgetTime();
  const t_s = driver.state.t_s;
  const reading = readSensorArray(spec, { ...sliders, t_s });
  return (
    <SimLayout
      viewer={
        <>
          <SensorScene {...{ spec, reading, t }} {...sliders} />
          <SimControls {...driver} t_s={t_s} />
        </>
      }
      values={<Values reading={reading} showBinary={showBinary} t={t} />}
      params={
        <ParamPanel
          params={paramsOf(sliders, t)}
          onChange={(key, value) => {
            setSliders((current) => applyChange(current, key, value));
          }}
        />
      }
    />
  );
}
