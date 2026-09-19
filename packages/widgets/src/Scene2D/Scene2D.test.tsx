import '@testing-library/jest-dom/vitest';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Scene2D } from './Scene2D';
import { Axes } from './primitives/Axes';
import { Circle } from './primitives/Circle';
import { Grid } from './primitives/Grid';
import { Label } from './primitives/Label';
import { Rect } from './primitives/Rect';
import { Trace } from './primitives/Trace';
import { Vector } from './primitives/Vector';

/** One recorded call to the 2D context: the method and the arguments it received. */
type Call = readonly [string, ...unknown[]];

/**
 * Stub of `CanvasRenderingContext2D` that records every call (#84, decision 6): jsdom has no
 * canvas backend, so the primitives are tested by what they ask the context to draw.
 */
function createStubContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push([name, ...args]);
    };
  const ctx = {
    canvas: null as unknown as HTMLCanvasElement,
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    rect: record('rect'),
    fill: record('fill'),
    stroke: record('stroke'),
    fillRect: record('fillRect'),
    clearRect: record('clearRect'),
    fillText: record('fillText'),
    setTransform: record('setTransform'),
    setLineDash: record('setLineDash'),
    translate: record('translate'),
    rotate: record('rotate'),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

/** Width every container reports, so the mapping is deterministic: 800 px at 16/9 → 450 px. */
const WIDTH_PX = 800;

let calls: Call[];
let resizeCallbacks: Array<() => void>;
let containerWidth_px = WIDTH_PX;

/** Calls recorded for one method, in order. */
function callsTo(name: string): Call[] {
  return calls.filter(([method]) => method === name);
}

/**
 * Same, without the calls of the scale bar: the scene always paints it last (docs/DESIGN.md §6),
 * so its strokes and caption would otherwise show up in every primitive's assertions.
 */
function primitiveCallsTo(name: string): Call[] {
  // Every painter brackets itself with save/restore, and the scale bar is the last one, so its
  // calls are those after the final `save`.
  const scaleBarStart = calls.map(([method]) => method).lastIndexOf('save');
  const painted = scaleBarStart < 0 ? calls : calls.slice(0, scaleBarStart);
  return painted.filter(([method]) => method === name);
}

/** Runs every pending `requestAnimationFrame` callback, so the coalesced repaint happens. */
function flushFrames(): void {
  act(() => {
    vi.advanceTimersByTime(32);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  const stub = createStubContext();
  calls = stub.calls;
  containerWidth_px = WIDTH_PX;
  resizeCallbacks = [];
  const getContext = function (this: HTMLCanvasElement): CanvasRenderingContext2D {
    (stub.ctx as { canvas: HTMLCanvasElement }).canvas = this;
    return stub.ctx;
  } as unknown as HTMLCanvasElement['getContext'];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(
    () => containerWidth_px,
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: () => void) {
        resizeCallbacks.push(() => {
          this.callback();
        });
      }
      observe(): void {}
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

describe('Scene2D', () => {
  test('exposes the scene as an image with the description it is given', () => {
    const { getByRole } = render(
      <Scene2D worldWidth_m={2} description="Escena de prueba">
        <Grid />
      </Scene2D>,
    );
    flushFrames();

    expect(getByRole('img')).toHaveAttribute('aria-label', 'Escena de prueba');
  });

  test('sizes the backing store by the device pixel ratio (hi-DPI)', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { container } = render(
      <Scene2D worldWidth_m={2} description="Escena">
        <Grid />
      </Scene2D>,
    );
    flushFrames();

    const canvas = container.querySelector('canvas');
    expect(canvas?.width).toBe(1600);
    expect(canvas?.height).toBe(900);
    // The context is scaled by the ratio, so the primitives keep drawing in CSS pixels.
    expect(callsTo('setTransform').at(-1)).toEqual(['setTransform', 2, 0, 0, 2, 0, 0]);
  });

  test('coalesces the changes of a frame into a single repaint (no continuous loop)', () => {
    render(
      <Scene2D worldWidth_m={2} description="Escena">
        <Grid />
        <Axes />
        <Vector to_m={[0.5, 0]} />
      </Scene2D>,
    );
    flushFrames();
    const paintsAfterMount = callsTo('clearRect').length;
    expect(paintsAfterMount).toBe(1);

    // Nothing changed: further frames must not repaint.
    flushFrames();
    expect(callsTo('clearRect')).toHaveLength(paintsAfterMount);
  });

  test('repaints once when the container is resized, keeping `worldWidth_m` visible', () => {
    render(
      <Scene2D worldWidth_m={2} description="Escena">
        <Vector to_m={[1, 0]} />
      </Scene2D>,
    );
    flushFrames();
    // At 800 px the tip of a 1 m vector from the origin lands on the right edge.
    expect(callsTo('lineTo')[0]).toEqual(['lineTo', 800, 225]);

    calls.length = 0;
    containerWidth_px = 400;
    act(() => {
      resizeCallbacks.forEach((notify) => {
        notify();
      });
    });
    flushFrames();

    expect(callsTo('clearRect')).toHaveLength(1);
    // Half the width still shows the same 2 m: the tip is again on the right edge, at 400 px.
    expect(callsTo('lineTo')[0]).toEqual(['lineTo', 400, 112.5]);
  });

  test('paints the primitives in the order of the children', () => {
    render(
      <Scene2D worldWidth_m={2} description="Escena">
        <Grid />
        <Circle center_m={[0, 0]} radius_m={0.2} />
        <Label at_m={[0, 0]} text="fin" />
      </Scene2D>,
    );
    flushFrames();

    const order = calls
      .map(([method]) => method)
      .filter((method) => method === 'arc' || method === 'fillText');
    // The circle's `arc` comes before the label's text, and both after the grid's strokes.
    expect(order[0]).toBe('arc');
    expect(order[1]).toBe('fillText');
  });

  test('renders a primitive outside a scene without painting or crashing', () => {
    expect(() => render(<Vector to_m={[1, 0]} />)).not.toThrow();
    flushFrames();
    expect(calls).toEqual([]);
  });
});

describe('primitives', () => {
  /** Renders `children` inside the 800 × 450 px scene of the golden values and paints once. */
  function paint(children: React.ReactNode): void {
    render(
      <Scene2D worldWidth_m={2} description="Escena">
        {children}
      </Scene2D>,
    );
    flushFrames();
  }

  test('Vector draws a 3 px arrow from tail to tip at the expected pixels', () => {
    paint(<Vector from_m={[0, 0]} to_m={[0, 0.5]} label="v" />);

    expect(callsTo('moveTo')[0]).toEqual(['moveTo', 400, 225]);
    expect(callsTo('lineTo')[0]).toEqual(['lineTo', 400, 25]);
    // Head: three more points closing the triangle at the tip.
    expect(callsTo('closePath')).toHaveLength(1);
    expect(callsTo('fill')).toHaveLength(1);
    expect(callsTo('fillText')[0]?.[1]).toBe('v');
  });

  test('Grid draws one line every 0.25 m by default', () => {
    paint(<Grid />);

    // 2 m across at 0.25 m: vertical lines at -1, -0.75 … 1 → 9 of them; 450 px is 1.125 m
    // tall, so the horizontal ones run from -0.5 to 0.5 → 5.
    const verticals = callsTo('moveTo').filter(([, , y_px]) => y_px === 0);
    expect(verticals).toHaveLength(9);
    expect(verticals[0]).toEqual(['moveTo', 0, 0]);
    const horizontals = callsTo('moveTo').filter(([, x_px]) => x_px === 0 && x_px !== undefined);
    // The first vertical starts at x = 0 too, so drop it before counting the horizontals.
    expect(horizontals.length - 1).toBe(5);
  });

  test('Grid honours a custom step and ignores a non-positive one', () => {
    paint(<Grid step_m={0.5} />);
    const verticals = callsTo('moveTo').filter(([, , y_px]) => y_px === 0);
    expect(verticals).toHaveLength(5);

    calls.length = 0;
    paint(<Grid step_m={0} />);
    expect(primitiveCallsTo('moveTo')).toEqual([]);
  });

  test('Grid skips a step so fine it would paint a solid block', () => {
    paint(<Grid step_m={0.0001} />);

    expect(primitiveCallsTo('moveTo')).toEqual([]);
  });

  test('Axes cross at the origin and carry the x and y labels', () => {
    paint(<Axes />);

    expect(callsTo('moveTo')).toContainEqual(['moveTo', 0, 225]);
    expect(callsTo('moveTo')).toContainEqual(['moveTo', 400, 450]);
    const labels = primitiveCallsTo('fillText').map(([, text]) => text);
    expect(labels).toEqual(['x', 'y']);
  });

  test('Trace draws a dotted 2 px path through its points', () => {
    paint(
      <Trace
        points_m={[
          [0, 0],
          [0.5, 0],
          [0.5, 0.25],
        ]}
      />,
    );

    expect(callsTo('setLineDash')[0]).toEqual(['setLineDash', [2, 3]]);
    expect(callsTo('moveTo')[0]).toEqual(['moveTo', 400, 225]);
    expect(primitiveCallsTo('lineTo')).toEqual([
      ['lineTo', 600, 225],
      ['lineTo', 600, 125],
    ]);
  });

  test('Trace with fewer than two points draws nothing', () => {
    paint(<Trace points_m={[[0, 0]]} />);

    expect(primitiveCallsTo('moveTo')).toEqual([]);
  });

  test('Circle draws an arc of the radius in pixels, filled when asked', () => {
    paint(<Circle center_m={[0.25, 0]} radius_m={0.1} filled />);

    expect(callsTo('arc')[0]).toEqual(['arc', 500, 225, 40, 0, Math.PI * 2]);
    expect(callsTo('fill')).toHaveLength(1);
  });

  test('Circle with a non-positive radius draws nothing', () => {
    paint(<Circle center_m={[0, 0]} radius_m={0} />);

    expect(callsTo('arc')).toEqual([]);
  });

  test('Rect rotates about its centre, clockwise on the canvas for a positive world angle', () => {
    paint(<Rect center_m={[0, 0]} width_m={0.4} height_m={0.2} angle_rad={0.5} />);

    expect(callsTo('translate')[0]).toEqual(['translate', 400, 225]);
    expect(callsTo('rotate')[0]).toEqual(['rotate', -0.5]);
    expect(callsTo('rect')[0]).toEqual(['rect', -80, -40, 160, 80]);
  });

  test('Rect fills at low opacity when asked, under the same outline', () => {
    paint(<Rect center_m={[0, 0]} width_m={0.4} height_m={0.2} filled />);

    expect(primitiveCallsTo('fill')).toHaveLength(1);
    expect(primitiveCallsTo('stroke')).toHaveLength(1);
  });

  test('Rect with a non-positive size draws nothing', () => {
    paint(<Rect center_m={[0, 0]} width_m={0} height_m={0.2} />);

    expect(callsTo('rect')).toEqual([]);
  });

  test('Vector of zero length draws the stroke but no arrow head', () => {
    paint(<Vector from_m={[0, 0]} to_m={[0, 0]} />);

    expect(primitiveCallsTo('closePath')).toEqual([]);
    expect(primitiveCallsTo('fill')).toEqual([]);
  });

  test('Label draws its text next to the anchor, on the side asked for', () => {
    paint(<Label at_m={[0, 0]} text="meta" align="left" />);

    const [call] = callsTo('fillText');
    expect(call?.[1]).toBe('meta');
    expect(call?.[2]).toBe(394);
    expect(call?.[3]).toBe(219);
  });

  test('Label with empty text draws nothing', () => {
    paint(<Label at_m={[0, 0]} text="" />);

    expect(primitiveCallsTo('fillText')).toEqual([]);
  });
});
