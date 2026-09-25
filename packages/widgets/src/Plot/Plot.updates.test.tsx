import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RingBuffer } from './RingBuffer';
import type { PlotSegment, PlotSeries } from './types';

/**
 * Regression tests of #338: the charts blinked while a simulation ran because every render of
 * the caller rebuilt the uPlot instance. The mock counts constructions and destructions; the
 * other methods only record that they were reached.
 */
const calls: unknown[] = [];
const setData = vi.fn();
const setScale = vi.fn();
const destroy = vi.fn();
const redraw = vi.fn();

vi.mock('uplot/dist/uPlot.min.css', () => ({}));
vi.mock('uplot', () => ({
  default: class UPlotMock {
    constructor(options: unknown) {
      calls.push(options);
    }
    setData = setData;
    setScale = setScale;
    destroy = destroy;
    redraw = redraw;
  },
}));

// jsdom implements neither `matchMedia` nor `devicePixelRatio`; the component checks for them.
vi.stubGlobal('matchMedia', () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }));
vi.stubGlobal('devicePixelRatio', 1);

const { Plot } = await import('./Plot');

/** Data of the most recent `setData` call: `[xs, ...series]`, as plain arrays. */
function lastData(): number[][] {
  const call = setData.mock.calls[setData.mock.calls.length - 1];
  if (call === undefined) throw new Error('setData was never called');
  return (call[0] as ArrayLike<number>[]).map((row) => Array.from(row));
}

/** Waits until the lazily imported chart has pushed its first window. */
async function waitForData(): Promise<void> {
  await vi.waitFor(() => {
    expect(setData.mock.calls.length).toBeGreaterThan(0);
  });
}

const ERROR: PlotSeries = {
  key: 'error',
  label: 'Error de línea',
  unit: 'm',
  data: [0.04, 0.02, -0.01],
};
const X = { label: 't', unit: 's', data: [0, 1, 2] };

beforeEach(() => {
  calls.length = 0;
  setData.mockClear();
  setScale.mockClear();
  destroy.mockClear();
  redraw.mockClear();
});

describe('Plot: actualizaciones sin reconstruir el gráfico (#338)', () => {
  it('keeps the same chart when the caller passes new x and series objects with new data', async () => {
    const { rerender } = render(<Plot x={{ ...X }} series={[{ ...ERROR }]} />);
    await waitForData();

    rerender(<Plot x={{ ...X, data: [0, 1, 2, 3] }} series={[{ ...ERROR, data: [1, 2, 3, 4] }]} />);
    await vi.waitFor(() => {
      expect(lastData()).toEqual([
        [0, 1, 2, 3],
        [1, 2, 3, 4],
      ]);
    });
    expect(calls).toHaveLength(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('keeps the same chart when the caller re-renders with fresh live literals', async () => {
    const buffer = new RingBuffer(100);
    for (let i = 0; i <= 10; i += 1) buffer.push(i, [i]);
    const view = (): JSX.Element => (
      <Plot
        x={{ label: 't', unit: 's' }}
        series={[{ key: 'v', label: 'v', unit: 'm' }]}
        live={{ buffer, windowSeconds: 4 }}
      />
    );
    const { rerender } = render(view());
    await waitForData();

    rerender(view());
    rerender(view());
    await vi.waitFor(() => {
      expect(setData.mock.calls.length).toBeGreaterThan(1);
    });
    expect(calls).toHaveLength(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('moves a segment by redrawing the same chart, not by rebuilding it', async () => {
    const segment = (to_s: number): PlotSegment[] => [{ from: [0, 0], to: [to_s, 1], label: 'm' }];
    const { rerender } = render(<Plot x={X} series={[ERROR]} segments={segment(1)} />);
    await waitForData();

    rerender(<Plot x={X} series={[ERROR]} segments={segment(2)} />);
    await vi.waitFor(() => {
      expect(redraw).toHaveBeenCalled();
    });
    expect(calls).toHaveLength(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('still rebuilds the chart when a series changes its label', async () => {
    const { rerender } = render(<Plot x={X} series={[ERROR]} />);
    await waitForData();

    rerender(<Plot x={X} series={[{ ...ERROR, label: 'Otra' }]} />);
    await vi.waitFor(() => {
      expect(calls).toHaveLength(2);
    });
  });
});
