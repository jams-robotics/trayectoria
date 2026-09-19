import type { JSX } from 'react';

import { GearWidget } from './GearWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'GearWidget', order: ['OneStage', 'TwoStage'] };

/** The single stage case of the golden values: 12:60 at 6000 rpm with η = 0.6 (#91, decision 6). */
export function OneStage(): JSX.Element {
  return (
    <GearWidget
      stages={1}
      initial={{ z1: 12, z2: 60, nIn_rpm: 6000, torqueIn_Nm: 0.012, efficiency: 0.6 }}
    />
  );
}

/**
 * The exact props of the «Explora» of T-4.4, opened at t = 0: this is the case captured in
 * `GearWidget.png` (#91, decision 6).
 */
export function TwoStage(): JSX.Element {
  return (
    <GearWidget
      stages={2}
      initial={{
        z1: 12,
        z2: 60,
        z3: 10,
        z4: 50,
        nIn_rpm: 6000,
        torqueIn_Nm: 0.012,
        efficiency: 0.6,
      }}
    />
  );
}
