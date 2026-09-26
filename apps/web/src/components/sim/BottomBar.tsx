import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { SPEEDS } from '@trayectoria/widgets/SimControls';
import type { SimulationDriver } from '@trayectoria/widgets';

// F4-02b (#128, decision 4): the fixed mobile bottom bar (docs/DESIGN.md §9.7): 56 px
// tall, Reproducir (primary and flexible), Pausa, Reiniciar and speed, all 44 px. «Paso»
// does not appear on mobile, which is why this bar does not reuse `SimControls`: the F2-02b
// component fixes the order Reproducir · Pausa · Paso · Reiniciar and cannot drop a button.

/** Height of the bar, in pixels (docs/DESIGN.md §9.7). Also the bottom padding of the content. */
export const BOTTOM_BAR_HEIGHT_PX = 56;

const BUTTON =
  'inline-flex h-11 items-center justify-center rounded-sm border px-3 text-sm font-semibold ' +
  'disabled:cursor-default disabled:opacity-45 focus-visible:outline-color-focus ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';
const PRIMARY = `${BUTTON} bg-primary text-primary-fg border-primary flex-1`;
const SECONDARY = `${BUTTON} bg-bg-raised text-fg border-border`;
const SELECT =
  'border-border bg-bg text-fg h-11 rounded-sm border px-2 font-mono text-sm tabular-nums ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

export interface BottomBarProps {
  readonly driver: SimulationDriver<unknown>;
}

/** Playback controls fixed to the bottom edge on mobile. */
export function BottomBar({ driver }: BottomBarProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('sims.mobilePage.controls')}
      data-testid="sim-bottom-bar"
      className="border-border bg-bg fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t px-4"
      style={{ height: `${String(BOTTOM_BAR_HEIGHT_PX)}px` }}
    >
      <button type="button" className={PRIMARY} onClick={driver.play} disabled={driver.running}>
        {t('widgets.SimControls.play')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.pause} disabled={!driver.running}>
        {t('widgets.SimControls.pause')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.reset}>
        {t('widgets.SimControls.reset')}
      </button>
      <select
        className={SELECT}
        aria-label={t('widgets.SimControls.speed')}
        value={driver.speed}
        onChange={(event) => {
          driver.setSpeed(Number(event.target.value));
        }}
      >
        {SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {t('widgets.SimControls.speedOption', { speed })}
          </option>
        ))}
      </select>
    </div>
  );
}
