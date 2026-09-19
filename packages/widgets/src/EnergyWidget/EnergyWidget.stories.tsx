import type { JSX } from 'react';

import { EnergyWidget } from './EnergyWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'EnergyWidget', order: ['Ramp', 'RampFriction', 'Power'] };

/** Time the captured story opens at, in seconds (#90, decision 7). */
const CAPTURE_TIME_S = 0.6;

/**
 * The exact props of the «Explora» of T-3.1, opened at t = 0.6 s: the body is already on the
 * ramp with part of its kinetic energy turned into height. This is the case captured in
 * `EnergyWidget.png` (#90, decision 7).
 */
export function Ramp(): JSX.Element {
  return (
    <EnergyWidget
      mode="ramp"
      initial={{ mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26 }}
      initialTime_s={CAPTURE_TIME_S}
    />
  );
}

/** Experiment 3 of T-3.1: the same ramp with μk = 0.05, which eats into `E_mec`. */
export function RampFriction(): JSX.Element {
  return (
    <EnergyWidget
      mode="ramp"
      initial={{ mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26, mu_k: 0.05 }}
      initialTime_s={CAPTURE_TIME_S}
    />
  );
}

/** The exact props of the «Explora» of T-3.2: the motor of the profile and its battery. */
export function Power(): JSX.Element {
  return (
    <EnergyWidget
      mode="power"
      initial={{ mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26 }}
      power={{
        torque_Nm: 0.03,
        omega_radps: 523.6,
        voltage_V: 6,
        current_A: 1.2,
        battery_Wh: 11.1,
      }}
    />
  );
}
