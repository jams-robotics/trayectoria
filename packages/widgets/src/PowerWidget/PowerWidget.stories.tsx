import type { JSX } from 'react';

import { PowerWidget } from './PowerWidget';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'PowerWidget', order: ['Lift', 'Top', 'DoublePower'] };

/** The golden case of docs/WIDGETS.md: 4.32 W lifting 0.9 kg by 1 m. */
const GOLDEN = { power_W: 4.32, mass_kg: 0.9 } as const;

/**
 * The golden case opened at t = 1 s: the load is half way up (h = 0.489 m) and the bar holds
 * E_p = 4.32 J. This is the case captured in `PowerWidget.png`.
 */
export function Lift(): JSX.Element {
  return <PowerWidget initial={GOLDEN} initialTime_s={1} />;
}

/** The same load past t_subida = 2.04 s: it stays at the top with the bar full. */
export function Top(): JSX.Element {
  return <PowerWidget initial={GOLDEN} initialTime_s={3} />;
}

/** Twice the power: the same load rises in t_subida = 1.02 s. */
export function DoublePower(): JSX.Element {
  return <PowerWidget initial={{ ...GOLDEN, power_W: 8.64 }} initialTime_s={0.5} />;
}
