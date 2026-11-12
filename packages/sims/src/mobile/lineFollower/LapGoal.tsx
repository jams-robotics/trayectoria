import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import type { LapGoalTrack } from './goalTrack';
import type { Lap, LapTimer } from './metrics';
import { bestLapOf, saveBestLap } from './stores/bestLaps';

// The lap-time game (v1.5): the record kept in this browser, the factory target of the track and
// a notice when a lap reaches it. It reads the laps the timer closes; it computes no time itself.

/** Decimals of the lap times, in seconds (docs/DESIGN.md §5: clock with two). */
const TIME_DECIMALS = 2;

export interface LapGoalProps {
  readonly timer: LapTimer;
  readonly goal: LapGoalTrack;
}

type Notice = { readonly kind: 'goal' | 'record'; readonly time: string } | null;

/** The record of the track and the notice of the last lap, kept in step with the timer. */
function useLapGoal(timer: LapTimer, { key, target_s }: LapGoalTrack): [number | null, Notice] {
  const [best_s, setBest] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const lap = timer.laps.at(-1);
  // The lap already counted: a track change leaves the old lap in the timer for one render.
  const counted = useRef<Lap | undefined>(undefined);
  useEffect(() => {
    setBest(bestLapOf(key));
    setNotice(null);
  }, [key]);
  useEffect(() => {
    if (lap === undefined) {
      counted.current = undefined;
      setNotice(null);
      return;
    }
    if (counted.current === lap) return;
    counted.current = lap;
    const record = saveBestLap(key, lap.lapTime_s);
    if (record) setBest(lap.lapTime_s);
    const time = lap.lapTime_s.toFixed(TIME_DECIMALS);
    if (target_s !== undefined && lap.lapTime_s <= target_s) setNotice({ kind: 'goal', time });
    else setNotice(record ? { kind: 'record', time } : null);
  }, [lap, key, target_s]);
  return [best_s, notice];
}

/** «Récord» and «Objetivo» of the track, with a polite notice when a lap beats either. */
export function LapGoal({ timer, goal }: LapGoalProps): JSX.Element {
  const t = useT();
  const { target_s } = goal;
  const [best_s, notice] = useLapGoal(timer, goal);
  const seconds = (value: number | null): string =>
    value === null ? '—' : `${value.toFixed(TIME_DECIMALS)} s`;
  return (
    <div className="flex flex-col gap-2" data-testid="lap-goal">
      <dl className="text-fg-muted flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-2">
          <dt>{t('sims.lapGoal.recordLabel')}</dt>
          <dd className="font-mono tabular-nums" data-testid="lap-goal-record">{seconds(best_s)}</dd>
        </div>
        {target_s === undefined ? null : (
          <div className="flex gap-2">
            <dt>{t('sims.lapGoal.targetLabel')}</dt>
            <dd className="font-mono tabular-nums" data-testid="lap-goal-target">{seconds(target_s)}</dd>
          </div>
        )}
      </dl>
      <p className="text-success text-sm font-semibold" role="status" data-testid="lap-goal-notice">
        {notice === null ? '' : t(`sims.lapGoal.${notice.kind}`, { time: notice.time })}
      </p>
    </div>
  );
}
