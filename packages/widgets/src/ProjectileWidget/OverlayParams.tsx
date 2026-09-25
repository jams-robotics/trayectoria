import { useState } from 'react';
import type { Dispatch, JSX, SetStateAction } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { ParamGrid } from '../shared/SimLayout';
import type { Launch, ProjectileMode } from './compute';
import { LaunchParams, applyChange } from './panels';

// Chip of the segmented control of docs/DESIGN.md §5, as `ModeToggle`: a `border` with `sm`
// radius, pressed in `primary` over `primary-fg`.
const CHIP = 'h-10 px-3 text-sm font-semibold transition-colors duration-[120ms]';
const PRESSED = `${CHIP} bg-primary text-primary-fg`;
const RELEASED = `${CHIP} text-fg-muted hover:text-fg`;

/** One launch state setter, so the side panel can edit either of the two drawn launches. */
export type SetLaunch = Dispatch<SetStateAction<Launch>>;

/** The `A` and `B` legends of the mode: two launches, or two drops in `drop` (#304). */
function legendsOf(mode: ProjectileMode, t: Translate): readonly [string, string] {
  return mode === 'drop'
    ? [t('widgets.ProjectileWidget.legendDropA'), t('widgets.ProjectileWidget.legendDropB')]
    : [t('widgets.ProjectileWidget.legendA'), t('widgets.ProjectileWidget.legendB')];
}

/** Shows or hides launch B (#361). A native button with `aria-pressed`. */
function OverlayToggle({
  mode,
  pressed,
  onToggle,
  t,
}: {
  mode: ProjectileMode;
  pressed: boolean;
  onToggle: () => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="border-border flex w-fit overflow-hidden rounded-sm border">
      <button
        type="button"
        className={pressed ? PRESSED : RELEASED}
        aria-pressed={pressed}
        onClick={onToggle}
      >
        {t(
          mode === 'drop'
            ? 'widgets.ProjectileWidget.toggleDropB'
            : 'widgets.ProjectileWidget.toggleB',
        )}
      </button>
    </div>
  );
}

/** Whether launch B is shown and how to toggle it (#361). */
export interface OverlayToggleState {
  shown: boolean;
  toggle: () => void;
}

/** The shown state of B, from `initialShowOverlay` (#361). */
export function useOverlayToggle(initialShown: boolean): OverlayToggleState {
  const [shown, setShown] = useState(initialShown);
  return {
    shown,
    toggle: () => {
      setShown((current) => !current);
    },
  };
}

export interface ParamsProps {
  mode: ProjectileMode;
  /** Every launch of the mode, B included while hidden, so its values are kept. */
  launches: readonly Launch[];
  onChange: readonly [SetLaunch, SetLaunch];
  /** The toggle of B; only read with two launches (#361). */
  toggle: OverlayToggleState;
  t: Translate;
}

/**
 * One `ParamPanel` per launch, under the viewer. With an overlay each panel carries its `A` or
 * `B` legend (#88, decision 7), the two sit side by side when they fit (§6) and the toggle of
 * B sits right above the panel of B, which it hides (#361).
 */
export function Params({ mode, launches, onChange, toggle, t }: ParamsProps): JSX.Element {
  const overlaid = launches.length > 1;
  const legends = legendsOf(mode, t);
  const panelOf = (launch: Launch, index: number): JSX.Element => (
    <LaunchParams
      key={legends[index]}
      mode={mode}
      launch={launch}
      legend={overlaid ? legends[index] : undefined}
      onChange={(key, value) => {
        onChange[index === 0 ? 0 : 1]((current) => applyChange(current, key, value));
      }}
      t={t}
    />
  );
  const [primary, secondary] = launches;
  return (
    <ParamGrid>
      {primary === undefined ? null : panelOf(primary, 0)}
      {secondary === undefined ? null : (
        <div className="flex flex-col gap-3">
          <OverlayToggle mode={mode} pressed={toggle.shown} onToggle={toggle.toggle} t={t} />
          {toggle.shown ? panelOf(secondary, 1) : null}
        </div>
      )}
    </ParamGrid>
  );
}
