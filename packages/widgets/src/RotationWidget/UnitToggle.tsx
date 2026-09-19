import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { RotationInputUnit } from './compute';

/** The two units `ω` may be edited in, in the order the segmented control shows them. */
const UNITS: readonly RotationInputUnit[] = ['rpm', 'radps'];

// Chip version of the segmented control of docs/DESIGN.md §5: container with a `border` and
// `sm` radius, children split by an inner border, active in `primary` over `primary-fg`.
const CHIP = 'h-10 px-3 text-sm font-semibold transition-colors duration-[120ms]';
const ACTIVE = `${CHIP} bg-primary text-primary-fg`;
const INACTIVE = `${CHIP} text-fg-muted hover:text-fg`;

export interface UnitToggleProps {
  value: RotationInputUnit;
  onChange: (unit: RotationInputUnit) => void;
  t: Translate;
}

/**
 * Chooses the unit `ω` is edited in, rpm or rad/s (docs/WIDGETS.md, RotationWidget; #89,
 * decision 4). Switching it keeps the physical value: only the slider changes unit, range and
 * step, and the values panel keeps showing both units either way.
 */
export function UnitToggle({ value, onChange, t }: UnitToggleProps): JSX.Element {
  return (
    <div
      className="border-border divide-border flex w-fit divide-x overflow-hidden rounded-sm border"
      role="group"
      aria-label={t('widgets.RotationWidget.inputUnit')}
    >
      {UNITS.map((unit) => (
        <button
          key={unit}
          type="button"
          className={unit === value ? ACTIVE : INACTIVE}
          aria-pressed={unit === value}
          onClick={() => {
            onChange(unit);
          }}
        >
          {t(`widgets.RotationWidget.unit${unit === 'rpm' ? 'Rpm' : 'Radps'}`)}
        </button>
      ))}
    </div>
  );
}
