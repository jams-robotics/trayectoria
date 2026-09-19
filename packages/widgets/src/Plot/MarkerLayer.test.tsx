import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MarkerLayer } from './MarkerLayer';

/** Keys are echoed with their params so the assertions can read the interpolated values. */
const t = (key: string, params?: Record<string, unknown>): string =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

/**
 * The marker over an x range of [0, 2] s, inside the relative wrapper `Plot` gives it: the
 * pointer drag measures that parent, so it is part of the contract under test.
 */
function renderMarker(x: number, onDrag?: (value: number) => void): HTMLElement {
  render(
    <div style={{ position: 'relative' }}>
      <MarkerLayer
        marker={onDrag === undefined ? { x } : { x, onDrag }}
        xRange={[0, 2]}
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

  it('ignores a pointer move with no button held and a track of zero width', async () => {
    const onDrag = vi.fn();
    const marker = renderMarker(1, onDrag);
    const track = marker.parentElement as HTMLElement;

    const user = userEvent.setup();
    // No button down: hovering must not move the marker.
    await user.pointer({ target: marker, coords: { clientX: 250, clientY: 10 } });
    expect(onDrag).not.toHaveBeenCalled();

    // A track that has not been laid out yet gives no usable position.
    track.getBoundingClientRect = () => ({ left: 0, width: 0 }) as DOMRect;
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
        <MarkerLayer marker={{ x: 5 }} xRange={[5, 5]} unit="s" t={t} />
      </div>,
    );

    expect(screen.getByTestId('plot-marker').style.left).toBe('0%');
  });
});
