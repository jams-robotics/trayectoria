import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { Scene2D } from './Scene2D';
import { Axes } from './primitives/Axes';
import { Circle } from './primitives/Circle';
import { Grid } from './primitives/Grid';
import { Label } from './primitives/Label';
import { Rect } from './primitives/Rect';
import { Trace } from './primitives/Trace';
import { Vector } from './primitives/Vector';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'Scene2D', order: ['Primitives', 'OffCentre'] };

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
