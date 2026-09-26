import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Vec2 } from '@trayectoria/sim-core';

import { Scene2D } from '../Scene2D/Scene2D';
import { DragHandle, SceneOverlay } from './SceneOverlay';

/** Width the fake `ResizeObserver` reports, so the scene has a real mapping in jsdom. */
const WIDTH_PX = 400;
/** World width of the test scene, in metres: 400 px over 2 m is 200 px per metre. */
const WORLD_WIDTH_M = 2;
const PX_PER_M = WIDTH_PX / WORLD_WIDTH_M;
/** Height of the scene at the default 16/9 aspect, in CSS pixels. */
const HEIGHT_PX = WIDTH_PX / (16 / 9);

/** A stub 2D context: enough for `Scene2D` to run its painters without throwing (jsdom has none). */
function stubCanvasContext(): CanvasRenderingContext2D {
  const noop = (): void => {
    // The stub never draws; it only lets `Scene2D` reach its registered painters.
  };
  return {
    save: noop,
    restore: noop,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    fillText: noop,
  } as unknown as CanvasRenderingContext2D;
}

/** jsdom has no `ResizeObserver` and reports a zero `clientWidth`; both are faked here. */
function installLayout(): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {}
      observe(): void {
        this.callback();
      }
      disconnect(): void {
        // Nothing to release: the fake never subscribes to anything.
      }
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(WIDTH_PX);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    width: WIDTH_PX,
    height: HEIGHT_PX,
    top: 0,
    left: 0,
    right: WIDTH_PX,
    bottom: HEIGHT_PX,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(stubCanvasContext());
}

/** A scene with a single handle, whose current value the test reads back as text. */
function Harness({ onChange }: { onChange: (next: Vec2) => void }): JSX.Element {
  const [value, setValue] = useState<Vec2>([0.2, 0.1]);
  return (
    <Scene2D worldWidth_m={WORLD_WIDTH_M} description="escena">
      <SceneOverlay>
        {({ transform, hostRef }) => (
          <DragHandle
            value={value}
            label="punta"
            transform={transform}
            hostRef={hostRef}
            onChange={(next) => {
              setValue(next);
              onChange(next);
            }}
          />
        )}
      </SceneOverlay>
    </Scene2D>
  );
}

/** A scene whose `worldWidth_m` the test can change with no resize, like `DiffDriveScene` zooming
 * to keep framing the ICR while a handle is dragged (#292). */
function ZoomingHarness({
  worldWidth_m,
  onChange,
}: {
  worldWidth_m: number;
  onChange: (next: Vec2) => void;
}): JSX.Element {
  return (
    <Scene2D worldWidth_m={worldWidth_m} description="escena">
      <SceneOverlay>
        {({ transform, hostRef }) => (
          <DragHandle
            value={[0, 0]}
            label="punta"
            transform={transform}
            hostRef={hostRef}
            onChange={onChange}
          />
        )}
      </SceneOverlay>
    </Scene2D>
  );
}

/** A pointer event with the capture methods jsdom does not implement. */
function pointer(x_px: number, y_px: number): Record<string, unknown> {
  return { clientX: x_px, clientY: y_px, pointerId: 1 };
}

/** Waits out the real `requestAnimationFrame` `Scene2D` schedules its coalesced repaint on. */
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('SceneOverlay (F2-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    installLayout();
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(true);
  });

  test('places the handle at the pixel of its tip, using the mapping of the scene', () => {
    render(<Harness onChange={vi.fn()} />);

    const handle = screen.getByRole('button', { name: 'punta' });
    // (0.2, 0.1) m from the centre of a 400 x 225 px canvas at 200 px/m, minus half the 24 px box.
    expect(handle.style.left).toBe(`${String(WIDTH_PX / 2 + 0.2 * PX_PER_M - 12)}px`);
    expect(handle.style.top).toBe(`${String(HEIGHT_PX / 2 - 0.1 * PX_PER_M - 12)}px`);
    expect(handle.style.visibility).toBe('visible');
  });

  test('a pointer drag converts canvas pixels back into world metres', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const handle = screen.getByRole('button', { name: 'punta' });

    act(() => {
      fireEvent.pointerDown(handle, pointer(WIDTH_PX / 2 + 60, HEIGHT_PX / 2 - 40));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [x_m, y_m] = onChange.mock.calls[0]?.[0] as Vec2;
    expect(x_m).toBeCloseTo(60 / PX_PER_M, 6);
    expect(y_m).toBeCloseTo(40 / PX_PER_M, 6);
  });

  test('a pointer move only moves the handle while the pointer is down', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const handle = screen.getByRole('button', { name: 'punta' });

    act(() => {
      fireEvent.pointerMove(handle, pointer(WIDTH_PX / 2 + 20, HEIGHT_PX / 2));
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      fireEvent.pointerDown(handle, pointer(WIDTH_PX / 2, HEIGHT_PX / 2));
      fireEvent.pointerMove(handle, pointer(WIDTH_PX / 2 + 20, HEIGHT_PX / 2));
    });
    expect(onChange).toHaveBeenCalledTimes(2);

    act(() => {
      fireEvent.pointerUp(handle, pointer(WIDTH_PX / 2 + 20, HEIGHT_PX / 2));
      fireEvent.pointerMove(handle, pointer(WIDTH_PX / 2 + 80, HEIGHT_PX / 2));
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  test('a key that is not an arrow leaves the handle where it is', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'punta' }), { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
  });

  test('outside a Scene2D the handle has no mapping and stays hidden', () => {
    render(
      <SceneOverlay>
        {({ transform, hostRef }) => (
          <DragHandle
            value={[0.2, 0.1]}
            label="punta"
            transform={transform}
            hostRef={hostRef}
            onChange={vi.fn()}
          />
        )}
      </SceneOverlay>,
    );

    // `visibility: hidden` also takes the handle out of the accessibility tree, which is the
    // point: there is nothing to drag until the scene has been measured.
    const handle = document.querySelector<HTMLButtonElement>('[data-handle="punta"]');
    expect(handle?.style.visibility).toBe('hidden');
    // It is also out of the accessibility tree: there is nothing to drag until it has a mapping.
    expect(screen.queryByRole('button', { name: 'punta' })).not.toBeInTheDocument();
  });

  test('a change of worldWidth_m with no resize re-reads the mapping of the scene (#292)', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<ZoomingHarness worldWidth_m={WORLD_WIDTH_M} onChange={onChange} />);
    await flushFrame();
    const handle = screen.getByRole('button', { name: 'punta' });
    // At 2 m across 400 px the origin handle sits at the centre of the canvas.
    expect(handle.style.left).toBe(`${String(WIDTH_PX / 2 - 12)}px`);

    // The scene zooms out with no resize of the container, as `DiffDriveScene` does while a
    // handle is dragged and the ICR moves further from the robot (#292): the overlay must adopt
    // the new mapping too, or the handle drifts away from the point it is meant to sit on.
    const WIDER_WORLD_WIDTH_M = WORLD_WIDTH_M * 2;
    rerender(<ZoomingHarness worldWidth_m={WIDER_WORLD_WIDTH_M} onChange={onChange} />);
    await flushFrame();

    act(() => {
      fireEvent.pointerDown(handle, pointer(WIDTH_PX / 2 + 60, HEIGHT_PX / 2));
    });
    const wider_px_per_m = WIDTH_PX / WIDER_WORLD_WIDTH_M;
    const [x_m] = onChange.mock.calls.at(-1)?.[0] as Vec2;
    expect(x_m).toBeCloseTo(60 / wider_px_per_m, 6);
  });

  test('a drag with no mapping yet is ignored instead of throwing', () => {
    const onChange = vi.fn();
    render(
      <SceneOverlay>
        {({ transform, hostRef }) => (
          <DragHandle
            value={[0.2, 0.1]}
            label="punta"
            transform={transform}
            hostRef={hostRef}
            onChange={onChange}
          />
        )}
      </SceneOverlay>,
    );

    act(() => {
      const handle = document.querySelector<HTMLButtonElement>('[data-handle="punta"]');
      if (handle !== null) fireEvent.pointerDown(handle, pointer(10, 10));
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
