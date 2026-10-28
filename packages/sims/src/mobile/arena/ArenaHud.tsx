import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { lapWins } from './race';
import type { Racer } from './race';

const CARD = 'rounded-lg border border-border bg-bg-raised/85 p-3 shadow-md backdrop-blur';

function seconds(value: number | undefined): string {
  return value === undefined ? '—' : `${value.toFixed(2)} s`;
}

function best(racer: Racer): number | undefined {
  return racer.laps_s.length === 0 ? undefined : Math.min(...racer.laps_s);
}

/** Seconds the learner leads the ghost by (negative: trails it), from the distance between them. */
function lead_s(you: Racer, ghost: Racer): number | null {
  const v = Math.abs(ghost.state.robot.v_mps);
  if (v < 0.01) return null;
  return (you.state.distance_m - ghost.state.distance_m) / v;
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        className={`font-mono leading-tight text-fg ${strong ? 'text-2xl font-semibold' : 'text-lg'}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Laps won by each racer, once at least one lap of both is closed. */
function Wins({ you, rival }: { you: Racer; rival: Racer }): JSX.Element | null {
  const t = useT();
  const wins = lapWins(you, rival);
  if (wins.you + wins.rival === 0) return null;
  return (
    <div className="col-span-2 flex items-baseline justify-between gap-2 border-t border-border pt-2">
      <span className="text-xs text-fg-muted">{t('sims.arena.hud.wins')}</span>
      <span className="font-mono text-lg text-fg">
        {`${t('sims.arena.you')} ${wins.you} · ${t('sims.arena.rival.name')} ${wins.rival}`}
      </span>
    </div>
  );
}

/** Lap counter, current and best lap, speed and the gap to the reference robot. */
export function LapBoard({ you, ghost }: { you: Racer; ghost: Racer | null }): JSX.Element {
  const t = useT();
  const lap = you.state.robot.t_s - you.state.lapStart_s;
  const gap = ghost === null ? null : lead_s(you, ghost);
  return (
    <section
      className={`${CARD} grid grid-cols-2 gap-x-5 gap-y-2`}
      aria-label={t('sims.arena.hud.laps')}
    >
      <Stat label={t('sims.arena.hud.lapTime')} value={seconds(lap)} strong />
      <Stat label={t('sims.arena.hud.laps')} value={String(you.laps_s.length)} strong />
      <Stat label={t('sims.arena.hud.best')} value={seconds(best(you))} />
      <Stat
        label={t('sims.arena.hud.speed')}
        value={`${Math.abs(you.state.robot.v_mps).toFixed(2)} m/s`}
      />
      {ghost === null ? null : <Wins you={you} rival={ghost} />}
      {gap === null ? null : (
        <div className="col-span-2 flex items-baseline justify-between gap-2 border-t border-border pt-2">
          <span className="text-xs text-fg-muted">{t('sims.arena.hud.gap')}</span>
          <span className={`font-mono text-lg ${gap >= 0 ? 'text-success' : 'text-error'}`}>
            {`${Math.abs(gap).toFixed(2)} s ${t(gap >= 0 ? 'sims.arena.hud.ahead' : 'sims.arena.hud.behind')}`}
          </span>
        </div>
      )}
    </section>
  );
}

/** One sensor of the array: a bar as tall as its reading, with the value under it. */
function SensorCell({ value }: { value: number }): JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <div className="relative h-12 w-full overflow-hidden rounded-sm bg-sim-sensor-off/40">
        <div
          className="absolute inset-x-0 bottom-0 bg-sim-sensor-on"
          style={{ height: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="font-mono text-xs text-fg">{value.toFixed(2)}</span>
    </div>
  );
}

/** Where the array sees the line, from −1 (left) to +1 (right), as a needle on a scale. */
function ErrorGauge({ position, lost }: { position: number; lost: boolean }): JSX.Element {
  const t = useT();
  const left = `${((position + 1) / 2) * 100}%`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{t('sims.arena.sensors.error')}</span>
        <span className={`font-mono ${lost ? 'text-error' : 'text-fg'}`}>
          {lost ? t('sims.arena.sensors.lost') : position.toFixed(2)}
        </span>
      </div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-error via-success to-error opacity-90">
        <div
          className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-full bg-fg shadow-md"
          style={{ left }}
        />
      </div>
      <div className="flex justify-between font-mono text-xs text-fg-muted">
        <span>−1 {t('sims.arena.sensors.left')}</span>
        <span>0</span>
        <span>+1 {t('sims.arena.sensors.right')}</span>
      </div>
    </div>
  );
}

/** The sensor array of the learner's robot, big: what the controller is reading right now. */
export function SensorPanel({ you }: { you: Racer }): JSX.Element {
  const t = useT();
  const { reading } = you.state;
  return (
    <section className={`${CARD} flex flex-col gap-3`} aria-label={t('sims.arena.sensors.title')}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-fg">{t('sims.arena.sensors.title')}</h2>
        <span className="text-xs text-fg-muted" title={t('sims.arena.sensors.hint')}>
          ⓘ
        </span>
      </div>
      <div className="flex gap-1">
        {reading.values.map((value, k) => (
          <SensorCell key={k} value={value} />
        ))}
      </div>
      <ErrorGauge position={reading.linePosition} lost={reading.lineLost} />
    </section>
  );
}

export { CARD as HUD_CARD };
