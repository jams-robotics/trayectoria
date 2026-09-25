import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Scene2D } from '../Scene2D/Scene2D';
import { Circle } from '../Scene2D/primitives/Circle';
import { Grid } from '../Scene2D/primitives/Grid';
import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import { Vector } from '../Scene2D/primitives/Vector';

/** Width over height of the view: the lift is taller than wide, with the bar beside it. */
const ASPECT = 4 / 3;
/** Every size of the scene is a share of `H`, so any lift height fills the view the same way. */
const LOAD_FACTOR = 0.15;
const DRUM_RADIUS_FACTOR = 0.06;
/** Gap between the top of the load at `h = H` and the bottom of the drum. */
const DRUM_GAP_FACTOR = 0.12;
const MOTOR_WIDTH_FACTOR = 0.22;
const MOTOR_HEIGHT_FACTOR = 0.14;
const GROUND_FACTOR = 0.03;
/** Margins of the view above the drum and below the ground, which leaves room for the scale. */
const TOP_MARGIN_FACTOR = 0.1;
const BOTTOM_MARGIN_FACTOR = 0.22;
/** Scene metres per m/s of the velocity arrow, capped so it stays inside the view. */
const M_PER_MPS = 0.25;
const MAX_ARROW_FACTOR = 0.35;

/** Height of the centre of the drum, in metres: above the load when it has reached `H`. */
export function drumY(liftHeight_m: number): number {
  return liftHeight_m * (1 + LOAD_FACTOR + DRUM_GAP_FACTOR + DRUM_RADIUS_FACTOR);
}

/** The visible window: from just below the ground to just above the drum. */
export function viewOf(liftHeight_m: number): { worldWidth_m: number; center_m: [number, number] } {
  const top_m = drumY(liftHeight_m) + liftHeight_m * (DRUM_RADIUS_FACTOR + TOP_MARGIN_FACTOR);
  const bottom_m = -liftHeight_m * BOTTOM_MARGIN_FACTOR;
  return {
    worldWidth_m: (top_m - bottom_m) * ASPECT,
    center_m: [0, (top_m + bottom_m) / 2],
  };
}

/** Length of the velocity arrow in scene metres, proportional to `v` up to its cap. */
export function arrowLength_m(speed_mps: number, liftHeight_m: number): number {
  return Math.min(speed_mps * M_PER_MPS, liftHeight_m * MAX_ARROW_FACTOR);
}

/** The ground, the motor with its drum and the cable down to the top of the load. */
function Hoist({
  liftHeight_m,
  worldWidth_m,
  loadTop_m,
}: {
  liftHeight_m: number;
  worldWidth_m: number;
  loadTop_m: number;
}): JSX.Element {
  const drum_m = drumY(liftHeight_m);
  const drumRadius_m = liftHeight_m * DRUM_RADIUS_FACTOR;
  const motorWidth_m = liftHeight_m * MOTOR_WIDTH_FACTOR;
  return (
    <>
      <Rect
        center_m={[0, (-liftHeight_m * GROUND_FACTOR) / 2]}
        width_m={worldWidth_m}
        height_m={liftHeight_m * GROUND_FACTOR}
        color="sim-track"
        filled
      />
      <Rect
        center_m={[drumRadius_m + motorWidth_m / 2, drum_m]}
        width_m={motorWidth_m}
        height_m={liftHeight_m * MOTOR_HEIGHT_FACTOR}
        color="color-border"
        filled
      />
      <Circle center_m={[0, drum_m]} radius_m={drumRadius_m} color="sim-axis" filled />
      <Trace
        points_m={[
          [-drumRadius_m, drum_m],
          [-drumRadius_m, loadTop_m],
        ]}
        color="sim-axis"
      />
    </>
  );
}

export interface PowerSceneProps {
  liftHeight_m: number;
  height_m: number;
  speed_mps: number;
  /** Whether the load is still rising: the velocity arrow is drawn only then. */
  rising: boolean;
  t: Translate;
}

/** The `--sim-robot` load and, while it rises, its velocity arrow beside it. */
function Load({ liftHeight_m, height_m, speed_mps, rising, t }: PowerSceneProps): JSX.Element {
  const load_m = liftHeight_m * LOAD_FACTOR;
  const cableX_m = -liftHeight_m * DRUM_RADIUS_FACTOR;
  const centreY_m = height_m + load_m / 2;
  const arrowX_m = cableX_m + load_m;
  return (
    <>
      <Rect
        center_m={[cableX_m, centreY_m]}
        width_m={load_m}
        height_m={load_m}
        color="sim-robot"
        filled
      />
      {rising ? (
        <Vector
          from_m={[arrowX_m, centreY_m]}
          to_m={[arrowX_m, centreY_m + arrowLength_m(speed_mps, liftHeight_m)]}
          color="color-vector-velocity"
          label={t('widgets.PowerWidget.vectorV')}
        />
      ) : null}
    </>
  );
}

/**
 * The lift: a motor with its drum at the top, the cable and the `--sim-robot` load rising from
 * `h = 0` to `H`, with its velocity in the fixed velocity token while it rises (docs/WIDGETS.md,
 * PowerWidget; docs/DESIGN.md §6). `Scene2D` draws the scale.
 */
export function PowerScene(props: PowerSceneProps): JSX.Element {
  const { liftHeight_m, height_m, t } = props;
  const view = viewOf(liftHeight_m);
  return (
    <Scene2D
      worldWidth_m={view.worldWidth_m}
      center_m={view.center_m}
      aspect={ASPECT}
      description={t('widgets.PowerWidget.scene')}
    >
      <Grid />
      <Hoist
        liftHeight_m={liftHeight_m}
        worldWidth_m={view.worldWidth_m}
        loadTop_m={height_m + liftHeight_m * LOAD_FACTOR}
      />
      <Load {...props} />
    </Scene2D>
  );
}
