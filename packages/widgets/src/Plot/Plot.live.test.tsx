import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Plot } from './Plot';
import { RingBuffer } from './RingBuffer';

const setScale = vi.fn();

vi.mock('uplot/dist/uPlot.min.css', () => ({}));
vi.mock('uplot', () => ({
  default: class UPlotMock {
    setData = vi.fn();
    setScale = setScale;
    destroy = vi.fn();
  },
}));
vi.stubGlobal('matchMedia', () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }));
vi.stubGlobal('devicePixelRatio', 1);

const X = { label: 't', unit: 's' };
const SERIES = [{ key: 'v', label: 'v', unit: 'm' }];

describe('Plot, live mode (v1.5)', () => {
  it('shows one line of text while nothing is recorded', () => {
    render(<Plot x={X} series={SERIES} live={{ buffer: new RingBuffer(10), windowSeconds: 4 }} />);
    expect(screen.getByText('Se dibuja al reproducir la simulación.')).toBeInTheDocument();
  });

  it('keeps the x scale from 0 to windowSeconds until the window slides', async () => {
    const buffer = new RingBuffer(100);
    for (let i = 0; i <= 2; i += 1) buffer.push(i, [i]);
    render(<Plot x={X} series={SERIES} live={{ buffer, windowSeconds: 4 }} />);
    await vi.waitFor(() => {
      expect(setScale).toHaveBeenCalledWith('x', { min: 0, max: 4 });
    });
  });
});
