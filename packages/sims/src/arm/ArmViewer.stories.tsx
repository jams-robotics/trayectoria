import type { JSX } from 'react';

import { ArmViewer } from './ArmViewer';

// `order` fixes the sequence of stories rendered by the /dev/sims playground, independent of the
// module iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'ArmViewer', order: ['Planar', 'So101'] };

/** Initial configuration of the planar arm, in radians: shoulder at 45°, elbow at −45°. */
const PLANAR_INITIAL_Q_RAD = [Math.PI / 4, -Math.PI / 4];

/**
 * 2-DOF planar arm from the catalog with the frames visible (#133, decision 9). It is the case
 * captured in `ArmViewer.png`.
 */
export function Planar(): JSX.Element {
  return <ArmViewer catalogId="planar2dof" initialQ={PLANAR_INITIAL_Q_RAD} show={['frames']} />;
}

/** The SO-101 from the catalog, with STL meshes and no frames: the other arm in the catalog. */
export function So101(): JSX.Element {
  return <ArmViewer catalogId="so101" show={[]} />;
}
