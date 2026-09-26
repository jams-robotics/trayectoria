import type { JSX } from 'react';

import { LineSensorWidget } from './LineSensorWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'LineSensorWidget', order: ['Explora61', 'Left6mm', 'Lost'] };

/**
 * The exact props of the «Explora» of T-6.1, paused at t = 0: the noise sample is the first one
 * of the fixed seed, so the case is static. This is the one captured in `LineSensorWidget.png`.
 */
export function Explora61(): JSX.Element {
  return <LineSensorWidget initialOffset_m={0} showBinary noiseSigma={0.03} />;
}

/** Golden value of docs/WIDGETS.md: 0.006 m to the left gives [0, 1, 1, 0, 0] and p = −0.25. */
export function Left6mm(): JSX.Element {
  return <LineSensorWidget initialOffset_m={0.006} showBinary />;
}

/** The line past 0.036 m to the left: «línea perdida», with p kept at −1. */
export function Lost(): JSX.Element {
  return <LineSensorWidget initialOffset_m={0.04} initialAngle_rad={0.2} />;
}
