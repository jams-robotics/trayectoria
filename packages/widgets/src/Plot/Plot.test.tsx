import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RingBuffer } from './RingBuffer';
import type { PlotSeries } from './types';

/**
 * uPlot paints on a canvas, which jsdom does not implement (decision 4 of the assignment of
 * #83). The mock records the options and data it is constructed with so the tests can assert
 * the props → options mapping, and the sliding window pushed on every frame.
 */
interface Call {
  options: Record<string, unknown>;
  data: unknown[];
}

const calls: Call[] = [];
const setData = vi.fn();
const setScale = vi.fn();
const destroy = vi.fn();

vi.mock('uplot/dist/uPlot.min.css', () => ({}));
vi.mock('uplot', () => ({
  default: class UPlotMock {
    constructor(options: Record<string, unknown>, data: unknown[]) {
      calls.push({ options, data });
    }
    setData = setData;
    setScale = setScale;
    destroy = destroy;
  },
}));

// jsdom implements neither `matchMedia` nor `devicePixelRatio`; the component checks for them
// before it loads uPlot, so the tests stand in for the browser that would provide them.
vi.stubGlobal('matchMedia', () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }));
vi.stubGlobal('devicePixelRatio', 1);

const { Plot } = await import('./Plot');

/** Options of the chart most recently created; uPlot is imported lazily, so this waits. */
async function lastOptions(): Promise<Record<string, unknown>> {
  await vi.waitFor(() => {
    expect(calls.length).toBeGreaterThan(0);
  });
  const last = calls[calls.length - 1];
  if (last === undefined) throw new Error('uPlot was never constructed');
  return last.options;
}

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
const OMEGA: PlotSeries = {
  key: 'omega',
  label: 'Velocidad angular',
  unit: 'm',
  data: [1, 0.5, -0.2],
};
const X = { label: 't', unit: 's', data: [0, 1, 2] };

beforeEach(() => {
  calls.length = 0;
  setData.mockClear();
  setScale.mockClear();
  destroy.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Plot: mapeo de props a opciones de uPlot', () => {
  it('builds one uPlot series per prop series, plus the x series', async () => {
    render(<Plot x={X} series={[ERROR, OMEGA]} />);

    const series = (await lastOptions()).series as { label?: string; width?: number; stroke?: string }[];
    expect(series).toHaveLength(3);
    expect(series[0]?.label).toBeUndefined();
    expect(series[1]?.label).toBe('Error de línea');
    expect(series[2]?.label).toBe('Velocidad angular');
    // docs/DESIGN.md §5: líneas 2 px.
    expect(series[1]?.width).toBe(2);
    expect(series[2]?.width).toBe(2);
  });

  it('gives each series its palette colour and its redundant dash (DESIGN.md §2.2)', async () => {
    render(<Plot x={X} series={[ERROR, OMEGA]} />);

    const series = (await lastOptions()).series as { stroke?: string; dash?: number[] }[];
    expect(series[1]?.stroke).not.toBe(series[2]?.stroke);
    // Serie 1 sólida, serie 2 discontinua 8-4.
    expect(series[1]?.dash).toBeUndefined();
    expect(series[2]?.dash).toEqual([8, 4]);
  });

  it('titles both axes with label and unit', async () => {
    render(<Plot x={X} series={[ERROR]} />);

    const axes = (await lastOptions()).axes as { scale?: string; label?: string; side?: number }[];
    expect(axes[0]?.scale).toBe('x');
    expect(axes[0]?.side).toBe(2);
    expect(axes[0]?.label).toBe('t (s)');
    expect(axes[1]?.scale).toBe('y');
    expect(axes[1]?.side).toBe(3);
    expect(axes[1]?.label).toBe('Error de línea (m)');
  });

  it('hides the uPlot legend and title: the card draws its own header', async () => {
    render(<Plot x={X} series={[ERROR, OMEGA]} />);

    expect((await lastOptions()).legend).toEqual({ show: false });
    expect((await lastOptions()).title).toBeUndefined();
    // Both series appear in the header legend with their name, never colour alone.
    expect(screen.getByText('Error de línea')).toBeInTheDocument();
    expect(screen.getByText('Velocidad angular')).toBeInTheDocument();
  });

  it('applies the requested height', async () => {
    render(<Plot x={X} series={[ERROR]} height={320} />);

    expect((await lastOptions()).height).toBe(320);
  });

  it('defaults to the 200 px height of docs/DESIGN.md §5', async () => {
    render(<Plot x={X} series={[ERROR]} />);

    expect((await lastOptions()).width).toBeGreaterThan(0);
    expect((await lastOptions()).height).toBe(200);
  });

  it('registers the reference lines as a plugin and widens the y range to fit them', async () => {
    render(<Plot x={X} series={[ERROR]} refLines={[{ y: 5, label: 'Límite' }]} />);

    // The ref-lines plugin plus the plot-area tracker `usePlotChart` always registers (#104).
    expect((await lastOptions()).plugins).toHaveLength(2);
    const scales = (await lastOptions()).scales as {
      y?: { range?: (self: unknown, min: number, max: number, key: string) => [number, number] };
    };
    const range = scales.y?.range;
    expect(typeof range).toBe('function');
    // The data stays under 1 but the reference line at 5 must remain visible.
    expect(range?.(null, 0, 1, 'y')[1]).toBeGreaterThanOrEqual(5);
  });

  it('sends the static data to the chart, x first', async () => {
    render(<Plot x={X} series={[ERROR, OMEGA]} />);
    await waitForData();

    expect(lastData()).toEqual([
      [0, 1, 2],
      [0.04, 0.02, -0.01],
      [1, 0.5, -0.2],
    ]);
  });

  it('destroys the chart on unmount', async () => {
    const view = render(<Plot x={X} series={[ERROR]} />);
    await waitForData();
    view.unmount();

    expect(destroy).toHaveBeenCalled();
  });
});

describe('Plot: modo live', () => {
  it('trims the data to the sliding window of windowSeconds', async () => {
    const buffer = new RingBuffer(100);
    for (let i = 0; i <= 10; i += 1) buffer.push(i, [i * 2]);

    render(<Plot x={X} series={[{ key: 'v', label: 'v', unit: 'm' }]} live={{ buffer, windowSeconds: 4 }} />);
    await vi.waitFor(() => {
      expect(lastData()[0]).toEqual([6, 7, 8, 9, 10]);
    });
    expect(lastData()[1]).toEqual([12, 14, 16, 18, 20]);
  });

  it('pins the x scale to the window instead of rebuilding the chart', async () => {
    const buffer = new RingBuffer(100);
    for (let i = 0; i <= 10; i += 1) buffer.push(i, [i]);

    render(<Plot x={X} series={[{ key: 'v', label: 'v', unit: 'm' }]} live={{ buffer, windowSeconds: 4 }} />);
    await vi.waitFor(() => {
      expect(setScale).toHaveBeenCalledWith('x', { min: 6, max: 10 });
    });
    // One chart only: a moving window must not recreate it.
    expect(calls).toHaveLength(1);
  });

  it('redraws at most once per frame and only when the buffer moved', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const buffer = new RingBuffer(100);
    buffer.push(0, [0]);

    render(<Plot x={X} series={[{ key: 'v', label: 'v', unit: 'm' }]} live={{ buffer, windowSeconds: 4 }} />);
    await waitForData();
    await vi.waitFor(() => {
      expect(frames.length).toBeGreaterThan(0);
    });

    const before = setData.mock.calls.length;
    // A frame with no new sample does not push data again.
    const idle = frames[frames.length - 1];
    idle?.(0);
    await Promise.resolve();
    expect(setData.mock.calls).toHaveLength(before);

    // With a new sample, the next frame pushes exactly once.
    buffer.push(1, [1]);
    frames[frames.length - 1]?.(16);
    await vi.waitFor(() => {
      expect(setData.mock.calls.length).toBe(before + 1);
    });
    vi.mocked(globalThis.requestAnimationFrame).mockRestore();
  });

  it('stops the frame loop on unmount', async () => {
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const buffer = new RingBuffer(10);
    const view = render(
      <Plot x={X} series={[{ key: 'v', label: 'v', unit: 'm' }]} live={{ buffer, windowSeconds: 4 }} />,
    );
    await waitForData();
    view.unmount();

    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });
});

describe('Plot: marcador', () => {
  it('renders the marker over the x range of the data and moves it with the arrows', async () => {
    const user = userEvent.setup();
    const onDrag = vi.fn();
    render(<Plot x={X} series={[ERROR]} marker={{ x: 1, onDrag }} />);

    const marker = screen.getByRole('slider');
    expect(marker).toHaveAttribute('aria-valuemin', '0');
    expect(marker).toHaveAttribute('aria-valuemax', '2');

    marker.focus();
    await user.keyboard('{ArrowRight}');
    expect(onDrag.mock.calls.at(-1)?.[0]).toBeCloseTo(1.04, 6);
  });

  it('does not render a marker when the prop is absent', () => {
    render(<Plot x={X} series={[ERROR]} />);

    expect(screen.queryByTestId('plot-marker')).toBeNull();
  });
});

describe('Plot: entornos sin canvas', () => {
  it('still renders the card without loading uPlot where there is no canvas', async () => {
    vi.stubGlobal('matchMedia', undefined);
    try {
      render(<Plot x={X} series={[ERROR]} marker={{ x: 1 }} />);
      // Header, legend, marker and live region are plain DOM and survive; only the drawing
      // is skipped, so a server render or a test environment never throws.
      expect(screen.getByText('Error de línea')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
      await Promise.resolve();
      expect(calls).toHaveLength(0);
    } finally {
      vi.stubGlobal('matchMedia', () => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
    }
  });

  it('follows the content width of its card through a ResizeObserver (#283)', async () => {
    const observers: (() => void)[] = [];
    class FakeResizeObserver {
      constructor(private readonly callback: () => void) {
        observers.push(callback);
      }
      observe(): void {
        /* the test triggers the callback itself */
      }
      disconnect(): void {
        /* nothing to release */
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    try {
      render(<Plot x={X} series={[ERROR]} />);
      await waitForData();
      const before = (await lastOptions()).width;

      // The chart area now measures 300 px, and the card 334 px with its padding and border:
      // the chart is rebuilt at the content width, not the card's, or it would overflow it.
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get(this: HTMLElement) {
          return this.tagName === 'FIGURE' ? 334 : 300;
        },
      });
      observers.forEach((notify) => {
        notify();
      });
      await vi.waitFor(async () => {
        expect((await lastOptions()).width).toBe(300);
      });
      expect(before).not.toBe(300);
    } finally {
      vi.stubGlobal('ResizeObserver', undefined);
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    }
  });
});

describe('Plot: tema y accesibilidad', () => {
  it('announces the state of the chart in a polite live region', () => {
    render(<Plot x={X} series={[ERROR, OMEGA]} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.textContent).toMatch(/\p{L}/u);
  });

  it('rereads the tokens when data-theme changes on <html>', async () => {
    const style = document.createElement('style');
    style.textContent = `
      :root { --sim-axis: #9fb0c0; --color-data-1: #0072b2; }
      :root[data-theme='dark'] { --sim-axis: #4b5b6c; --color-data-1: #5aa9e6; }
    `;
    document.head.append(style);
    try {
      render(<Plot x={X} series={[ERROR]} />);
      const before = ((await lastOptions()).series as { stroke?: string }[])[1]?.stroke;

      document.documentElement.setAttribute('data-theme', 'dark');
      await vi.waitFor(() => {
        const rebuilt = calls[calls.length - 1]?.options.series as { stroke?: string }[];
        expect(rebuilt[1]?.stroke).not.toBe(before);
      });
    } finally {
      document.documentElement.removeAttribute('data-theme');
      style.remove();
    }
  });
});
