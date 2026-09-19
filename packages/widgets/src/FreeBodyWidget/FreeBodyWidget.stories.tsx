import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { FreeBodyWidget } from './FreeBodyWidget';
import type { ForceInput } from './compute';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'FreeBodyWidget', order: ['Plane', 'Ramp15'] };

/** Mass of the reference robot, in kilograms (docs/CURRICULUM.md T-2.1). */
const MASS_KG = 0.9;
/** A 15° ramp in radians, the value of experiment 2 of T-2.1 (#86, decision 7). */
const RAMP_15_RAD = 0.2618;

/** The forces of the «Explora» of T-2.1: traction 1.5 N and rolling friction 0.4 N. */
function exploreForces(t: Translate): ForceInput[] {
  return [
    {
      key: 'traction',
      label: t('widgets.FreeBodyWidget.traction'),
      magnitude_N: 1.5,
      angle_rad: 0,
      editable: true,
    },
    {
      key: 'friction',
      label: t('widgets.FreeBodyWidget.friction'),
      magnitude_N: 0.4,
      angle_rad: 3.1416,
      editable: true,
    },
  ];
}

/** The exact props of the «Explora» of T-2.1 on a flat plane (docs/CURRICULUM.md). */
export function Plane(): JSX.Element {
  const t = useT();
  return <FreeBodyWidget mass_kg={MASS_KG} forces={exploreForces(t)} slope_rad={0} showResultant />;
}

/**
 * The same body on the 15° ramp of experiment 2 of T-2.1. This is the case captured in
 * `FreeBodyWidget.png` (#86, decision 7).
 */
export function Ramp15(): JSX.Element {
  const t = useT();
  return (
    <FreeBodyWidget
      mass_kg={MASS_KG}
      forces={exploreForces(t)}
      slope_rad={RAMP_15_RAD}
      showResultant
    />
  );
}
