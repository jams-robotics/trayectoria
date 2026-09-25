import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { ProjectileMode } from './compute';

// Chip version of the segmented control of docs/DESIGN.md §5, as `RotationWidget/UnitToggle`:
// container with a `border` and `sm` radius, children split by an inner border, active in
// `primary` over `primary-fg`.
const CHIP = 'h-10 px-3 text-sm font-semibold transition-colors duration-[120ms]';
const ACTIVE = `${CHIP} bg-primary text-primary-fg`;
const INACTIVE = `${CHIP} text-fg-muted hover:text-fg`;

export interface ModeToggleProps {
  modes: readonly ProjectileMode[];
  value: ProjectileMode;
  onChange: (mode: ProjectileMode) => void;
  t: Translate;
}

/**
 * Switches between the modes of `modes`: «Lanzar», «Soltar» and «Soltar desde robot» (#304).
 * Native buttons with `aria-pressed`, so `Tab` reaches each one and `Enter` or `Space` picks it.
 */
export function ModeToggle({ modes, value, onChange, t }: ModeToggleProps): JSX.Element {
  return (
    <div
      className="border-border divide-border flex w-fit divide-x overflow-hidden rounded-sm border"
      role="group"
      aria-label={t('widgets.ProjectileWidget.modeGroup')}
    >
      {modes.map((mode) => (
        <button
          key={mode}
          type="button"
          className={mode === value ? ACTIVE : INACTIVE}
          aria-pressed={mode === value}
          onClick={() => {
            onChange(mode);
          }}
        >
          {t(`widgets.ProjectileWidget.mode${mode}`)}
        </button>
      ))}
    </div>
  );
}
