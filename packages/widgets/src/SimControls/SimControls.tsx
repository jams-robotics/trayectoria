import type { JSX, KeyboardEvent } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import type { SimulationDriver } from '../Scene2D/useSimulationDriver';

/** Speeds of the selector, in simulated seconds per real second (docs/DESIGN.md §5). */
export const SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4];

/** Decimals of the clock (docs/DESIGN.md §5: `t 00.00 s`). */
const CLOCK_DECIMALS = 2;
/** Digits before the decimal point of the clock, so it does not jump as time grows. */
const CLOCK_INTEGER_DIGITS = 2;

const BUTTON =
  'inline-flex h-9 items-center rounded-sm border px-3 text-sm font-semibold transition-colors' +
  ' duration-[120ms] disabled:cursor-default disabled:opacity-45';
const PRIMARY = `${BUTTON} bg-primary text-primary-fg border-primary hover:bg-primary-hover`;
const SECONDARY = `${BUTTON} bg-bg-raised text-fg border-border hover:border-fg-muted`;
const SELECT =
  'border-border bg-bg text-fg h-9 rounded-sm border px-2 font-mono text-sm tabular-nums';

export interface SimControlsProps extends SimulationDriver<unknown> {
  /** Hides the clock, for a small viewer (docs/DESIGN.md §5). Defaults to false. */
  compact?: boolean;
}

/** Simulated time as `00.00`, padded so the field keeps its width. */
export function formatTime(t_s: number): string {
  const safe_s = Number.isFinite(t_s) ? Math.max(t_s, 0) : 0;
  return safe_s.toFixed(CLOCK_DECIMALS).padStart(CLOCK_INTEGER_DIGITS + CLOCK_DECIMALS + 1, '0');
}

/** Buttons of the fixed order Reproducir · Pausa · Paso · Reiniciar (docs/DESIGN.md §5). */
function Buttons({
  driver,
  t,
}: {
  driver: SimulationDriver<unknown>;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <button type="button" className={PRIMARY} onClick={driver.play} disabled={driver.running}>
        {t('widgets.SimControls.play')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.pause} disabled={!driver.running}>
        {t('widgets.SimControls.pause')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.step}>
        {t('widgets.SimControls.step')}
      </button>
      <button type="button" className={SECONDARY} onClick={driver.reset}>
        {t('widgets.SimControls.reset')}
      </button>
    </>
  );
}

/**
 * The shortcuts of docs/DESIGN.md §5: Espacio play/pausa, `.` paso, `R` reiniciar. They are
 * bound to the container, never to the document, so they only fire while the focus is inside the
 * widget and never steal a key from the page (#85, decision 5).
 */
function handleShortcut(
  event: KeyboardEvent<HTMLDivElement>,
  driver: SimulationDriver<unknown>,
): void {
  // A key typed inside the speed selector belongs to the selector.
  if (event.target instanceof HTMLSelectElement) return;
  const { key } = event;
  if (key === ' ' || key === 'Spacebar') {
    event.preventDefault();
    if (driver.running) driver.pause();
    else driver.play();
    return;
  }
  if (key === '.') {
    event.preventDefault();
    driver.step();
    return;
  }
  if (key === 'r' || key === 'R') {
    event.preventDefault();
    driver.reset();
  }
}

/** The speed selector and, unless `compact`, the clock (docs/DESIGN.md §5). */
function SpeedAndClock({
  driver,
  compact,
  t,
}: {
  driver: SimulationDriver<unknown>;
  compact: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <>
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
      {compact ? null : (
        <span className="text-fg-muted ml-1 font-mono text-sm tabular-nums" data-testid="sim-clock">
          {t('widgets.SimControls.clock', { time: formatTime(driver.t_s) })}
        </span>
      )}
    </>
  );
}

/**
 * Playback controls of a simulation (docs/DESIGN.md §5): Reproducir · Pausa · Paso · Reiniciar ·
 * Velocidad · reloj, in that order. It takes the object `useSimulationDriver` returns and owns no
 * state of its own.
 */
export function SimControls({ compact = false, ...driver }: SimControlsProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('widgets.SimControls.title')}
      data-compact={compact}
      className="flex flex-wrap items-center gap-2"
      onKeyDown={(event) => {
        handleShortcut(event, driver);
      }}
    >
      <Buttons driver={driver} t={t} />
      <SpeedAndClock driver={driver} compact={compact} t={t} />
      <p className="sr-only" role="status" aria-live="polite">
        {t(
          driver.running ? 'widgets.SimControls.statusRunning' : 'widgets.SimControls.statusPaused',
          { time: formatTime(driver.t_s) },
        )}
      </p>
    </div>
  );
}
