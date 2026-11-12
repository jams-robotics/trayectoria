import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { t } from '@trayectoria/i18n';

import { LapGoal } from './LapGoal';
import { createLapTimer, recordLap } from './metrics';
import { bestLapOf } from './stores/bestLaps';

// The real store is covered by its own test; here it is an in-memory one.
const records = vi.hoisted(() => new Map<string, number>());
vi.mock('./stores/bestLaps', () => ({
  bestLapOf: (key: string): number | null => records.get(key) ?? null,
  saveBestLap: (key: string, lap_s: number): boolean => {
    const current = records.get(key);
    if (current !== undefined && current <= lap_s) return false;
    records.set(key, lap_s);
    return true;
  },
}));

const LENGTH_M = 3;

/** A timer with one lap of `time_s`. */
function timerOf(time_s: number): ReturnType<typeof createLapTimer> {
  return recordLap(createLapTimer(LENGTH_M), time_s, LENGTH_M);
}

describe('LapGoal', () => {
  beforeEach(() => {
    records.clear();
  });

  it('shows the target and an empty record before any lap', () => {
    render(<LapGoal timer={createLapTimer(LENGTH_M)} goal={{ key: 'oval', target_s: 8 }} />);
    expect(screen.getByTestId('lap-goal-target')).toHaveTextContent('8.00 s');
    expect(screen.getByTestId('lap-goal-record')).toHaveTextContent('—');
  });

  it('saves the lap and announces the target when it is reached', () => {
    render(<LapGoal timer={timerOf(7.5)} goal={{ key: 'oval', target_s: 8 }} />);
    expect(screen.getByTestId('lap-goal-notice')).toHaveTextContent(t('sims.lapGoal.goal', { time: '7.50' }));
    expect(screen.getByTestId('lap-goal-record')).toHaveTextContent('7.50 s');
    expect(bestLapOf('oval')).toBe(7.5);
  });

  it('announces a new record on a track without target', () => {
    render(<LapGoal timer={timerOf(12)} goal={{ key: 'custom:3000' }} />);
    expect(screen.queryByTestId('lap-goal-target')).not.toBeInTheDocument();
    expect(screen.getByTestId('lap-goal-notice')).toHaveTextContent(t('sims.lapGoal.record', { time: '12.00' }));
  });
});
