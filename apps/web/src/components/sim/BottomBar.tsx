import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { SPEEDS } from '@trayectoria/widgets/SimControls';
import type { SimulationDriver } from '@trayectoria/widgets';

// F4-02b (#128, decisión 4): la barra inferior fija de móvil (docs/DESIGN.md §9.7): 56 px de
// alto, Reproducir (primario y flexible), Pausa, Reiniciar y velocidad, todos de 44 px. «Paso»
// no aparece en móvil, por eso esta barra no reutiliza `SimControls`: el componente de F2-02b
// fija el orden Reproducir · Pausa · Paso · Reiniciar y no admite quitar un botón.

/** Alto de la barra, en píxeles (docs/DESIGN.md §9.7). También es el padding inferior del contenido. */
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

/** Controles de reproducción fijos al borde inferior en móvil. */
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
