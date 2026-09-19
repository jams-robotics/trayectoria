import type { JSX } from 'react';

import { RotationWidget } from './RotationWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'RotationWidget', order: ['Disc', 'Rolling', 'AngularAccel'] };

/** Time the captured story opens at, in seconds (#89, decision 8). */
const CAPTURE_TIME_S = 0.15;

/** The exact props of the «Explora» of T-4.1: the wheel of the profile at 200 rpm. */
export function Disc(): JSX.Element {
  return (
    <RotationWidget mode="disc" inputUnit="rpm" initial={{ omega_radps: 20.94, r_m: 0.032 }} />
  );
}

/**
 * The «Explora» of T-4.2, opened at t = 0.15 s: this is the case captured in
 * `RotationWidget.png` (#89, decision 8).
 */
export function Rolling(): JSX.Element {
  return (
    <RotationWidget
      mode="rolling"
      inputUnit="rpm"
      initial={{ omega_radps: 20.94, r_m: 0.032 }}
      initialTime_s={CAPTURE_TIME_S}
    />
  );
}

/** The «Explora» of T-4.3: the wheel ramps up from rest at 41.89 rad/s². */
export function AngularAccel(): JSX.Element {
  return (
    <RotationWidget
      mode="angularAccel"
      initial={{ omega_radps: 0, r_m: 0.032, alpha_radps2: 41.89 }}
    />
  );
}
