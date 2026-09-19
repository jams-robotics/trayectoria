import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { Ramp } from './compute';
import { FLAT_LENGTH_M } from './model';
import { useTimeline } from './timeline';

/** The «Explora» of T-3.1: the profile robot at 0.6 m/s up a 0.26 rad ramp. */
const RAMP: Ramp = { mass_kg: 0.9, v0_mps: 0.6, slope_rad: 0.26, mu_k: 0 };

describe('EnergyWidget timeline (F2-07)', () => {
  test('opens at rest at the start of the track', () => {
    const { result } = renderHook(() => useTimeline(RAMP, 0));
    expect(result.current.t_s).toBe(0);
    expect(result.current.state.s_m).toBe(0);
    expect(result.current.state.v_mps).toBe(0.6);
  });

  test('`initialTime_s` opens it part way through the run, on the ramp', () => {
    const { result } = renderHook(() => useTimeline(RAMP, 0.6));
    expect(result.current.t_s).toBe(0.6);
    expect(result.current.state.s_m).toBeGreaterThan(FLAT_LENGTH_M);
    expect(result.current.state.v_mps).toBeLessThan(0.6);
  });

  test('a negative `initialTime_s` is read as the start of the run', () => {
    const { result } = renderHook(() => useTimeline(RAMP, -1));
    expect(result.current.t_s).toBe(0);
    expect(result.current.state.s_m).toBe(0);
  });

  test('«Reiniciar» takes a fixed opening time back to the start', () => {
    const { result } = renderHook(() => useTimeline(RAMP, 0.6));
    act(() => {
      result.current.controls.reset();
    });
    expect(result.current.t_s).toBe(0);
    expect(result.current.state.s_m).toBe(0);
  });

  test('«Paso» advances the run from wherever it was opened', () => {
    const { result } = renderHook(() => useTimeline(RAMP, 0));
    act(() => {
      result.current.controls.step();
    });
    expect(result.current.driver.t_s).toBeGreaterThan(0);
  });

  test('exposes the playback actions `SimControls` needs', () => {
    const { result } = renderHook(() => useTimeline(RAMP, 0));
    expect(typeof result.current.controls.play).toBe('function');
    expect(typeof result.current.driver.pause).toBe('function');
    expect(typeof result.current.driver.setSpeed).toBe('function');
  });

  test('a change of parameters shows the new run, not the one it left', () => {
    const { result, rerender } = renderHook(({ ramp }) => useTimeline(ramp, 0.6), {
      initialProps: { ramp: RAMP },
    });
    const before = result.current.state.s_m;
    rerender({ ramp: { ...RAMP, v0_mps: 1.2 } });
    expect(result.current.state.s_m).not.toBe(before);
  });
});
