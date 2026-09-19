import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MarkerLayer } from './MarkerLayer';
import type { PlotArea } from './options';

/** Keys are echoed with their params so the assertions can read the interpolated values. */
const t = (key: string, params?: Record<string, unknown>): string =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

/** A plot area flush with the card: `left_px: 0`, so a ratio-based test can still read `%`-like px. */
const FLUSH_PLOT_AREA: PlotArea = { left_px: 0, width_px: 200 };

/**
 * The marker over an x range of [0, 2] s, inside the relative wrapper `Plot` gives it: the
 * pointer drag measures that parent, so it is part of the contract under test.
 */
function renderMarker(
  x: number,
  onDrag?: (value: number) => void,
  plotArea: PlotArea = FLUSH_PLOT_AREA,
): HTMLElement {
  render(
    <div style={{ position: 'relative' }}>
      <MarkerLayer
        marker={onDrag === undefined ? { x } : { x, onDrag }}
        xRange={[0, 2]}
        plotArea={plotArea}
        unit="s"
        t={t}
      />
    </div>,
  );
  return screen.getByTestId('plot-marker');
}

describe('MarkerLayer', () => {
  it('moves with the arrow keys and calls onDrag (criterio de aceptación de F2-01b)', async () => {
    const user = userEvent.setup();
    const onDrag = vi.fn();
    const marker = renderMarker(1, onDrag);

    marker.focus();
    await user.keyboard('{ArrowRight}');

    expect(onDrag).toHaveBeenCalled();
    // The range is [0, 2]; one arrow step is 2 % of it.
    expect(onDrag.mock.calls.at(-1)?.[0]).toBeCloseTo(1.04, 6);

    onDrag.mockClear();
    await user.keyboard('{ArrowLeft}');
    expect(onDrag.mock.calls.at(-1)?.[0]).toBeCloseTo(0.96, 6);
  });

  it('also answers the vertical arrows, as a slider must', async () => {
    const user = userEvent.setup();
    const onDrag = vi.fn();
    renderMarker(1, onDrag).focus();

    await user.keyboard('{ArrowUp}');
    expect(onDrag.mock.calls.at(-1)?.[0]).toBeCloseTo(1.04, 6);
    await user.keyboard('{ArrowDown}');
    expect(onDrag.mock.calls.at(-1)?.[0]).toBeCloseTo(0.96, 6);
  });

  it('takes a bigger step with Shift and never leaves the x range', async () => {
    const user = userEvent.setup();
    const onDrag = vi.fn();
    renderMarker(2, onDrag).focus();

    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(onDrag.mock.calls.at(-1)?.[0]).toBeCloseTo(1.8, 6);

    // Already at the right edge: it clamps instead of running off the chart.
    onDrag.mockClear();
    await user.keyboard('{ArrowRight}');
    expect(onDrag).toHaveBeenCalledWith(2);
  });

  it('ignores keys that are not arrows', async () => {
    const user = userEvent.setup();
    const onDrag = vi.fn();
    renderMarker(1, onDrag).focus();

    await user.keyboard('{Enter}a');

    expect(onDrag).not.toHaveBeenCalled();
  });

  it('exposes its position as a slider for assistive technology', () => {
    const marker = renderMarker(1);

    expect(marker).toHaveAttribute('role', 'slider');
    expect(marker).toHaveAttribute('aria-valuenow', '1');
    expect(marker).toHaveAttribute('aria-valuemin', '0');
    expect(marker).toHaveAttribute('aria-valuemax', '2');
    expect(marker.getAttribute('aria-valuetext')).toContain('1.00');
    expect(marker.getAttribute('aria-label')).toBe('widgets.Plot.marker');
    // Reachable with Tab, as every control must be (docs/DESIGN.md §8).
    expect(marker).toHaveAttribute('tabindex', '0');
  });

  it('survives a marker without onDrag: it simply does not move', async () => {
    const user = userEvent.setup();
    const marker = renderMarker(1);
    marker.focus();

    await user.keyboard('{ArrowRight}');

    expect(marker).toHaveAttribute('aria-valuenow', '1');
  });

  it('drags with the pointer within the x range', async () => {
    const onDrag = vi.fn();
    const marker = renderMarker(1, onDrag);
    const track = marker.parentElement as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 100, width: 200 }) as DOMRect;

    const user = userEvent.setup();
    await user.pointer([
      { keys: '[MouseLeft>]', target: marker },
      { target: marker, coords: { clientX: 250, clientY: 10 } },
      { keys: '[/MouseLeft]', target: marker },
    ]);

    // Three quarters along a [0, 2] range.
    expect(onDrag).toHaveBeenCalledWith(1.5);
  });

  it('ignores a pointer move with no button held and a plot area of zero width', async () => {
    const onDrag = vi.fn();
    const marker = renderMarker(1, onDrag);
    const track = marker.parentElement as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 200 }) as DOMRect;

    const user = userEvent.setup();
    // No button down: hovering must not move the marker.
    await user.pointer({ target: marker, coords: { clientX: 250, clientY: 10 } });
    expect(onDrag).not.toHaveBeenCalled();
  });

  it('ignores a pointer move when the plot area has not been laid out yet', async () => {
    const onDrag = vi.fn();
    // A plot area that has not been laid out yet (uPlot has not reported its geometry) gives
    // no usable position.
    const marker = renderMarker(1, onDrag, { left_px: 0, width_px: 0 });
    const track = marker.parentElement as HTMLElement;
    track.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;

    const user = userEvent.setup();
    await user.pointer([
      { keys: '[MouseLeft>]', target: marker },
      { target: marker, coords: { clientX: 250, clientY: 10 } },
      { keys: '[/MouseLeft]', target: marker },
    ]);
    expect(onDrag).not.toHaveBeenCalled();
  });

  it('pins the marker to the left edge when the range is a single point', () => {
    render(
      <div style={{ position: 'relative' }}>
        <MarkerLayer marker={{ x: 5 }} xRange={[5, 5]} plotArea={FLUSH_PLOT_AREA} unit="s" t={t} />
      </div>,
    );

    expect(screen.getByTestId('plot-marker').style.left).toBe('0px');
  });

  it('offsets the marker by the plot area left, not a percentage of the card (#104)', () => {
    // The y-axis label channel and the chart's padding shift uPlot's plot area 40 px in from
    // the card's edge; before the fix the marker used `ratio * 100%` of the whole card, which
    // draws it to the left of its real x whenever that channel is non-zero.
    const marker = renderMarker(1, undefined, { left_px: 40, width_px: 200 });

    // ratio 0.5 of [0, 2] at x=1, over a 200 px wide plot area starting 40 px in.
    expect(marker.style.left).toBe('140px');
  });

  it('converts a pointer position back to x using the plot area, not the whole card', async () => {
    const onDrag = vi.fn();
    const marker = renderMarker(1, onDrag, { left_px: 40, width_px: 200 });
    const track = marker.parentElement as HTMLElement;
    // The card starts at clientX 0; the plot area therefore starts at clientX 40.
    track.getBoundingClientRect = () => ({ left: 0, width: 240 }) as DOMRect;

    const user = userEvent.setup();
    await user.pointer([
      { keys: '[MouseLeft>]', target: marker },
      // 90 px into the 200 px plot area (clientX 130 - left_px 40): 45 % along [0, 2].
      { target: marker, coords: { clientX: 130, clientY: 10 } },
      { keys: '[/MouseLeft]', target: marker },
    ]);

    expect(onDrag).toHaveBeenCalledWith(0.9);
  });
});
