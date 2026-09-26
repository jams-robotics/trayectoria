import type { JSX } from 'react';

import { DiffDriveWidget } from './DiffDriveWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default {
  title: 'DiffDriveWidget',
  order: ['Forward51', 'Forward52', 'Inverse53', 'Odometry54', 'Maneuver55'],
};

/** Time the captured story opens at, in seconds (#92, decision 7). */
const CAPTURE_TIME_S = 3;
/** Time the odometry story opens at, in seconds (#93, decision 4). */
const ODOMETRY_CAPTURE_TIME_S = 10;

/** The exact props of the «Explora» of T-5.1: the frames and the trace while it arcs. */
export function Forward51(): JSX.Element {
  return (
    <DiffDriveWidget
      mode="forward"
      show={['frames', 'trace']}
      initial={{ omegaL_radps: 6, omegaR_radps: 8 }}
      duration_s={6}
    />
  );
}

/**
 * The «Explora» of T-5.2, opened at t = 3 s: this is the case captured in
 * `DiffDriveWidget.png` (#92, decision 7).
 */
export function Forward52(): JSX.Element {
  return (
    <DiffDriveWidget
      mode="forward"
      show={['icr', 'radius', 'trace', 'wheelVelocities', 'frames']}
      initial={{ omegaL_radps: 15, omegaR_radps: 20 }}
      duration_s={8}
      initialTime_s={CAPTURE_TIME_S}
    />
  );
}

/** The «Explora» of T-5.3: `v` and `ω` commanded, with the wheel speeds derived from them. */
export function Inverse53(): JSX.Element {
  return (
    <DiffDriveWidget
      mode="inverse"
      show={['icr', 'radius', 'wheelVelocities']}
      initial={{ v_mps: 0.4, omega_radps: 1.5 }}
      duration_s={6}
    />
  );
}

/**
 * The «Explora» of T-5.4, opened at t = 10 s: this is the case captured in
 * `DiffDriveWidget-odometry.png` (#93, decision 4). The believed radius of the widget opens at
 * the real one; the snapshot is taken after moving it to 0.033 m, which separates both traces.
 */
export function Odometry54(): JSX.Element {
  return (
    <DiffDriveWidget
      mode="odometry"
      show={['trace', 'frames']}
      initial={{ omegaL_radps: 12, omegaR_radps: 13 }}
      duration_s={20}
      initialTime_s={ODOMETRY_CAPTURE_TIME_S}
    />
  );
}

/**
 * The «Explora» of T-5.5: no lateral command, and the three-move maneuver behind its switch
 * (#394). The switch opens off; `DiffDriveWidget-maneuver.png` is taken after turning it on.
 */
export function Maneuver55(): JSX.Element {
  return (
    <DiffDriveWidget
      mode="inverse"
      show={['frames', 'trace']}
      initial={{ v_mps: 0.3, omega_radps: 0 }}
      maneuver={{ turn_deg: 90, distance_m: 0.2 }}
      duration_s={6}
    />
  );
}
