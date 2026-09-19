import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { REFERENCE_PID_PARAMS, presets } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { useLineFollower } from './useLineFollower';

const SPEC = referenceMobile as RobotSpec;

function options(overrides: Partial<Parameters<typeof useLineFollower>[0]> = {}): Parameters<
  typeof useLineFollower
>[0] {
  return {
    spec: SPEC,
    track: presets.oval,
    controller: 'pid',
    params: { ...REFERENCE_PID_PARAMS },
    ...overrides,
  };
}

describe('useLineFollower (F4-02a)', () => {
  it('arranca pausado en t = 0 con la traza en la pose inicial', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    expect(result.current.driver.running).toBe(false);
    expect(result.current.state.robot.t_s).toBe(0);
    expect(result.current.trace_m).toHaveLength(1);
    expect(result.current.trace_m[0]?.[0]).toBeCloseTo(result.current.state.robot.x_m, 9);
  });

  it('avanza un paso del modelo y acumula traza al cabo de varios', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    act(() => {
      result.current.driver.step();
    });
    expect(result.current.state.robot.t_s).toBeGreaterThan(0);
    const before = result.current.trace_m.length;
    for (let k = 0; k < 40; k += 1) {
      act(() => {
        result.current.driver.step();
      });
    }
    expect(result.current.trace_m.length).toBeGreaterThan(before);
  });

  it('reinicia el estado y la traza', () => {
    const { result } = renderHook(() => useLineFollower(options()));
    for (let k = 0; k < 30; k += 1) {
      act(() => {
        result.current.driver.step();
      });
    }
    act(() => {
      result.current.driver.reset();
    });
    expect(result.current.state.robot.t_s).toBe(0);
    expect(result.current.trace_m).toHaveLength(1);
  });

  it('reconstruye la simulación cuando cambian los parámetros', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useLineFollower>[0]) => useLineFollower(props),
      { initialProps: options() },
    );
    act(() => {
      result.current.driver.step();
    });
    expect(result.current.state.robot.t_s).toBeGreaterThan(0);
    rerender(options({ params: { ...REFERENCE_PID_PARAMS, kp: 5 } }));
    expect(result.current.state.robot.t_s).toBe(0);
  });

  it('acepta ruido en los sensores', () => {
    const { result } = renderHook(() => useLineFollower(options({ noiseSigma: 0.05 })));
    act(() => {
      result.current.driver.step();
    });
    expect(result.current.state.reading.values).toHaveLength(5);
  });
});
