import type { JSX } from 'react';

import { KinematicsWidget } from './KinematicsWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'KinematicsWidget', order: ['Curriculum03', 'Mru', 'Mrua'] };

/** Time the captured story opens at, in seconds (#87, decision 8). */
const CAPTURE_TIME_S = 2;

/**
 * The exact props of the «Explora» of T-0.3, opened with the marker at t = 2 s: this is the
 * case captured in `KinematicsWidget.png` (#87, decision 8).
 */
export function Curriculum03(): JSX.Element {
  return (
    <KinematicsWidget
      initial={{ x0_m: 0, v0_mps: 0.5, a_mps2: 0.2 }}
      editable={['v0', 'a']}
      duration_s={5}
      showTangent
      initialTime_s={CAPTURE_TIME_S}
    />
  );
}

/** The exact props of the «Explora» of T-1.1: uniform motion at 0.4 m/s over 10 s. */
export function Mru(): JSX.Element {
  return (
    <KinematicsWidget
      initial={{ x0_m: 0, v0_mps: 0.4, a_mps2: 0 }}
      editable={['x0', 'v0']}
      duration_s={10}
    />
  );
}

/** The exact props of the «Explora» of T-1.2: from rest with a = 0.4 m/s² over 4 s. */
export function Mrua(): JSX.Element {
  return (
    <KinematicsWidget
      initial={{ x0_m: 0, v0_mps: 0, a_mps2: 0.4 }}
      editable={['v0', 'a']}
      duration_s={4}
    />
  );
}
