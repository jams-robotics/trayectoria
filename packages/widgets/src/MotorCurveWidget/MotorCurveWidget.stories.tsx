import type { JSX } from 'react';

import { MotorCurveWidget } from './MotorCurveWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'MotorCurveWidget', order: ['Reference', 'NoCurrents', 'Editable'] };

/** The line of the reference robot (docs/WIDGETS.md): τ_s = 0.012 N·m and n₀ = 6000 rpm. */
const LINE = { stallTorque_Nm: 0.012, noLoadSpeed_rpm: 6000 } as const;
/** Its currents and supply: I₀ = 0.1 A, I_s = 1.2 A at 6 V (P_el = 3.9 W in 3000 rpm). */
const CURRENTS = { noLoadCurrent_A: 0.1, stallCurrent_A: 1.2, voltage_V: 6 } as const;

/**
 * The reference robot with its currents, opened at the maximum power point (3000 rpm): τ = 0.006
 * N·m, P = 1.885 W, I = 0.65 A, η = 0.483. This is the case captured in `MotorCurveWidget.png`.
 */
export function Reference(): JSX.Element {
  return <MotorCurveWidget initial={{ ...LINE, ...CURRENTS, speed_rpm: 3000 }} />;
}

/** The same line without currents: no current, electrical power or efficiency rows. */
export function NoCurrents(): JSX.Element {
  return <MotorCurveWidget initial={LINE} />;
}

/** With τ_s and n₀ as sliders: doubling τ_s to 0.024 N·m lifts P_max to 3.77 W. */
export function Editable(): JSX.Element {
  return (
    <MotorCurveWidget
      initial={{ ...LINE, ...CURRENTS, speed_rpm: 3000 }}
      editable={['stallTorque_Nm', 'noLoadSpeed_rpm']}
    />
  );
}
