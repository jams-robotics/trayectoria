import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { useTimeline } from './timeline';

describe('PowerWidget timeline (#360)', () => {
  test('opens at t = 0, or at `initialTime_s` when it is given', () => {
    expect(renderHook(() => useTimeline(2.044, 0)).result.current.t_s).toBe(0);
    expect(renderHook(() => useTimeline(2.044, 1)).result.current.t_s).toBe(1);
    expect(renderHook(() => useTimeline(2.044, -1)).result.current.t_s).toBe(0);
  });

  test('«Reiniciar» takes a fixed opening time back to the start', () => {
    const { result } = renderHook(() => useTimeline(2.044, 1));
    act(() => {
      result.current.controls.reset();
    });
    expect(result.current.t_s).toBe(0);
  });

  test('«Paso» advances the time one step', () => {
    const { result } = renderHook(() => useTimeline(2.044, 0));
    act(() => {
      result.current.controls.step();
    });
    expect(result.current.t_s).toBeCloseTo(0.01, 6);
  });

  test('the playback pauses once the load has reached the top', () => {
    const { result } = renderHook(() => useTimeline(0.005, 0));
    act(() => {
      result.current.controls.step();
    });
    act(() => {
      result.current.controls.play();
    });
    expect(result.current.driver.running).toBe(false);
  });

  test('below the top the playback keeps running', () => {
    const { result } = renderHook(() => useTimeline(2.044, 0));
    act(() => {
      result.current.controls.play();
    });
    expect(result.current.driver.running).toBe(true);
    act(() => {
      result.current.driver.pause();
    });
  });

  test('a new rise time keeps the current time instead of rewinding it', () => {
    const { result, rerender } = renderHook(({ rise }) => useTimeline(rise, 0), {
      initialProps: { rise: 2.044 },
    });
    act(() => {
      result.current.controls.step();
    });
    rerender({ rise: 1.022 });
    expect(result.current.t_s).toBeCloseTo(0.01, 6);
  });
});
