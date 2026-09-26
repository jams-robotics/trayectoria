import type { JSX } from 'react';
import type { MobileSpec } from '@trayectoria/robot-spec';
import { PRESET_LINE_WIDTH_M, sensorPositions } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Label } from '../Scene2D/primitives/Label';
import { Rect } from '../Scene2D/primitives/Rect';
import type { SensorArrayReading } from './compute';

/** World width across the canvas, in metres: the offset range plus the line on both sides. */
const WORLD_WIDTH_M = 0.14;
/** Length of the drawn stretch of line, in metres: longer than the canvas diagonal. */
const LINE_LENGTH_M = 0.3;
/** Depth of the drawn sensor board, in metres. */
const BOARD_DEPTH_M = 0.008;
/** Margin of the board past the outer sensors, in metres. */
const BOARD_MARGIN_M = 0.006;
/** Height of the index labels above the sensors, in metres. */
const LABEL_HEIGHT_M = 0.009;

/** Each sensor as its footprint, lit when `b_k = 1`, with its index above it. */
function SensorMarks({
  sensors,
  footprint_m,
  binary,
}: {
  sensors: readonly number[];
  footprint_m: number;
  binary: readonly (0 | 1)[];
}): JSX.Element {
  return (
    <>
      {sensors.map((x_m, k) => (
        <Circle
          key={`sensor-${String(k)}`}
          center_m={[x_m, 0]}
          radius_m={footprint_m / 2}
          color={binary[k] === 1 ? 'sim-sensor-on' : 'sim-sensor-off'}
          filled
        />
      ))}
      {sensors.map((x_m, k) => (
        <Label key={`label-${String(k)}`} at_m={[x_m, LABEL_HEIGHT_M]} text={String(k)} />
      ))}
    </>
  );
}

export interface SensorSceneProps {
  spec: MobileSpec;
  offset_m: number;
  angle_rad: number;
  reading: SensorArrayReading;
  t: Translate;
}

/**
 * Top view of the array over the line. The scene is {R} turned so that X (forward) points up
 * and the array sits at the origin: a point `(x, y)` of {R} is drawn at `(−y, x − d)`, so the
 * left of the robot is the left of the canvas and sensor 0 is the leftmost one.
 */
export function SensorScene({
  spec,
  offset_m,
  angle_rad,
  reading,
  t,
}: SensorSceneProps): JSX.Element {
  const { count, spacing_m, footprint_m } = spec.lineSensors;
  const sensors = sensorPositions(spec).map(([, side_m]) => -side_m);
  return (
    <Scene2D
      worldWidth_m={WORLD_WIDTH_M}
      description={t('widgets.LineSensorWidget.scene', {
        offset: String(offset_m),
        angle: String(angle_rad),
      })}
    >
      <Rect
        center_m={[-offset_m, 0]}
        width_m={PRESET_LINE_WIDTH_M}
        height_m={LINE_LENGTH_M}
        angle_rad={angle_rad}
        color="sim-track"
        filled
      />
      <Rect
        center_m={[0, 0]}
        width_m={(count - 1) * spacing_m + 2 * BOARD_MARGIN_M}
        height_m={BOARD_DEPTH_M}
        color="sim-robot"
      />
      <SensorMarks sensors={sensors} footprint_m={footprint_m} binary={reading.binary} />
    </Scene2D>
  );
}
