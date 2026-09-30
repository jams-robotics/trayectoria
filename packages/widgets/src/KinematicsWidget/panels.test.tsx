import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Translate } from '@trayectoria/i18n';

import { MotionScene, useSceneAspect } from './panels';
import type { Motion } from './compute';

/** Translation stub: returns the key, so the tests read the structure and not the Spanish. */
const t: Translate = (key) => key;

/**
 * Width every container reports: 720 px, 405 px high at the 16/9 of the scene (jsdom has no
 * `matchMedia`, so the hook answers the `lg` aspect).
 */
const WIDTH_PX = 720;

/** Arguments of every `arc` the scene paints: only the particle draws one. */
let arcs: number[][];

beforeEach(() => {
  vi.useFakeTimers();
  arcs = [];
  const noop = (): void => {};
  const ctx = new Proxy(
    { canvas: null as unknown as HTMLCanvasElement },
    {
      get: (target, key) => {
        if (key === 'canvas') return target.canvas;
        if (key === 'arc') return (...args: number[]) => arcs.push(args);
        if (key === 'measureText') return () => ({ width: 10 });
        return noop;
      },
      set: (target, key, value: HTMLCanvasElement) => {
        if (key === 'canvas') target.canvas = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    (ctx as unknown as { canvas: HTMLCanvasElement }).canvas = this;
    return ctx;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => WIDTH_PX);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(): void {
        this.callback();
      }
      disconnect(): void {}
    },
  );
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number =>
    setTimeout(() => {
      cb(0);
    }, 16) as unknown as number,
  );
  vi.stubGlobal('cancelAnimationFrame', (handle: number): void => {
    clearTimeout(handle);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** The last `arc` painted for the motion at `t_s`: `[x_px, y_px, radius_px, …]`. */
function particleArc(motion: Motion, t_s: number): number[] {
  arcs = [];
  const { unmount } = render(<MotionScene motion={motion} t_s={t_s} duration_s={5} t={t} />);
  act(() => {
    vi.advanceTimersByTime(32);
  });
  unmount();
  const arc = arcs.at(-1);
  if (arc === undefined) throw new Error('the scene painted no particle');
  return arc;
}

describe('MotionScene (#303)', () => {
  test('el radio de la partícula en píxeles es el mismo con v0 = 0.2 y con v0 = 1', () => {
    const slow = particleArc({ x0_m: 0, v0_mps: 0.2, a_mps2: 0 }, 5);
    const fast = particleArc({ x0_m: 0, v0_mps: 1, a_mps2: 0 }, 5);
    expect(slow[2]).toBeGreaterThan(0);
    expect(fast[2]).toBe(slow[2]);
  });

  test('con a < 0 la partícula sigue en el visor al final, en x(5) = −10.25 m', () => {
    const motion: Motion = { x0_m: 0, v0_mps: 0.7, a_mps2: -1.1 };
    for (const t_s of [0, 2.5, 5]) {
      const [x_px = Number.NaN] = particleArc(motion, t_s);
      expect(x_px).toBeGreaterThan(0);
      expect(x_px).toBeLessThan(WIDTH_PX);
    }
  });
});

/** A `matchMedia` that answers `matches` to every query and remembers its change listeners. */
function stubMatchMedia(matches: boolean): { listeners: Array<() => void>; queries: string[] } {
  const listeners: Array<() => void> = [];
  const queries: string[] = [];
  vi.stubGlobal('matchMedia', (query: string) => {
    queries.push(query);
    return {
      matches,
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.splice(listeners.indexOf(listener), 1);
      },
    };
  });
  return { listeners, queries };
}

describe('useSceneAspect (#544)', () => {
  test('desde lg el visor es 16/9, el de todos los visores', () => {
    const { queries } = stubMatchMedia(true);
    const { result } = renderHook(() => useSceneAspect());
    expect(result.current).toBeCloseTo(16 / 9, 10);
    expect(queries).toContain('(min-width: 1024px)');
  });

  test('bajo lg el visor es 3/2: al menos 200 px de alto desde 360 px de ancho', () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useSceneAspect());
    expect(result.current).toBeCloseTo(3 / 2, 10);
    // 360 px of screen minus the 16 px gutters of §9: 328 px wide, 218 px high.
    expect((360 - 2 * 16) / result.current).toBeGreaterThanOrEqual(200);
  });

  test('sin matchMedia (render en servidor, jsdom) queda en 16/9', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useSceneAspect());
    expect(result.current).toBeCloseTo(16 / 9, 10);
  });

  test('sigue el cambio de la consulta y se da de baja al desmontar', () => {
    const media = stubMatchMedia(true);
    const { result, unmount } = renderHook(() => useSceneAspect());
    expect(media.listeners).toHaveLength(1);
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    act(() => {
      for (const listener of media.listeners) listener();
    });
    expect(result.current).toBeCloseTo(3 / 2, 10);
    unmount();
    expect(media.listeners).toHaveLength(0);
  });
});
