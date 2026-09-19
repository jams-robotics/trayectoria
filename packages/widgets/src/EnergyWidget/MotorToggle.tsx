import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { MotorCount } from './compute';

/** The two motor counts the electrical block adds up, in the order the control shows them. */
const COUNTS: readonly MotorCount[] = [1, 2];

// Chip version of the segmented control of docs/DESIGN.md §5: container with a `border` and
// `sm` radius, children split by an inner border, active in `primary` over `primary-fg`.
const CHIP = 'h-10 px-3 font-mono text-sm font-semibold transition-colors duration-[120ms]';
const ACTIVE = `${CHIP} bg-primary text-primary-fg`;
const INACTIVE = `${CHIP} text-fg-muted hover:text-fg`;

export interface MotorToggleProps {
  value: MotorCount;
  onChange: (motors: MotorCount) => void;
  t: Translate;
}

/**
 * Chooses how many motors the electrical power adds up, one or two (#90, decision 6). «Al
 * robot» of T-3.2 works out the autonomy of the two motors of the profile, so two is the
 * default; one shows the learner how the draw and the autonomy scale with the count.
 */
export function MotorToggle({ value, onChange, t }: MotorToggleProps): JSX.Element {
  return (
    <div
      className="border-border divide-border flex w-fit divide-x overflow-hidden rounded-sm border"
      role="group"
      aria-label={t('widgets.EnergyWidget.motors')}
    >
      {COUNTS.map((count) => (
        <button
          key={count}
          type="button"
          className={count === value ? ACTIVE : INACTIVE}
          aria-pressed={count === value}
          aria-label={t(`widgets.EnergyWidget.motors${count}`)}
          onClick={() => {
            onChange(count);
          }}
        >
          {count}
        </button>
      ))}
    </div>
  );
}
