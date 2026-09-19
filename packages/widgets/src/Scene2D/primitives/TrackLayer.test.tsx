import '@testing-library/jest-dom/vitest';
import { act, render } from '@testing-library/react';
import { oval } from '@trayectoria/sim-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Scene2D } from '../Scene2D';
import { TrackLayer } from './TrackLayer';

/** One recorded call to the 2D context: the method and the arguments it received. */
type Call = readonly [string, ...unknown[]];

/** Golden view of the ticket: 800 px wide at 16/9 → 450 px tall, 2 m across → 400 px/m. */
const WIDTH_PX = 800;
const HEIGHT_PX = 450;
const PX_PER_M = WIDTH_PX / 2;

let calls: Call[];
let containerWidth_px = WIDTH_PX;

/**
 * Stub of `CanvasRenderingContext2D` that records every call: jsdom has no canvas backend, so
 * the primitives are checked by what they ask the context to draw (same harness as Scene2D.test
 * and RobotBody.test).
 */
function createStubContext(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const recorded: Call[] = [];
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      recorded.push([name, ...args]);
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
    arcTo: record('arcTo'),
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
    set fillStyle(value: string) {
      recorded.push(['fillStyle', value]);
    },
    get fillStyle(): string {
      return '';
    },
    set lineWidth(value: number) {
      recorded.push(['lineWidth', value]);
    },
    get lineWidth(): number {
      return 0;
    },
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls: recorded };
}

/**
 * Calls of one method, without the scale bar: the scene always paints it last (docs/DESIGN.md
 * §6), so its strokes and caption would otherwise show up in every primitive's assertions.
 */
function primitiveCallsTo(name: string): Call[] {
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

describe('TrackLayer (F2-02b)', () => {
  test('draws the oval preset segment by segment, straights as lines and curves as arcs', () => {
    render(
      <Scene2D worldWidth_m={2} description="Pista">
        <TrackLayer track={oval} />
      </Scene2D>,
    );
    flushFrames();

    const straights = oval.segments.filter((segment) => segment.type === 'line');
    const curves = oval.segments.filter((segment) => segment.type === 'arc');
    expect(primitiveCallsTo('lineTo')).toHaveLength(straights.length);
    expect(primitiveCallsTo('arc')).toHaveLength(curves.length);
  });

  test('maps the first straight of the oval to the expected pixels at 10 px wide (golden value of F2-02b)', () => {
    render(
      <Scene2D worldWidth_m={2} description="Pista">
        <TrackLayer track={oval} />
      </Scene2D>,
    );
    flushFrames();

    // `oval` starts with the straight (0, 0) → (0.6, 0): 400 px, on the horizontal mid-line.
    expect(primitiveCallsTo('moveTo')[0]).toEqual(['moveTo', WIDTH_PX / 2, HEIGHT_PX / 2]);
    expect(primitiveCallsTo('lineTo')[0]).toEqual([
      'lineTo',
      WIDTH_PX / 2 + 0.6 * PX_PER_M,
      HEIGHT_PX / 2,
    ]);
    // The whole centerline is one stroke of 10 px (docs/DESIGN.md §6).
    expect(primitiveCallsTo('stroke')).toHaveLength(1);
    expect(primitiveCallsTo('lineWidth').map(([, value]) => value)).toContain(10);
  });

  test('flips the sense of an arc for the canvas, where y points downwards', () => {
    render(
      <Scene2D worldWidth_m={2} description="Pista">
        <TrackLayer track={oval} />
      </Scene2D>,
    );
    flushFrames();

    // First arc of `oval`: centre (0.6, 0.25), r = 0.25 m, from −π/2 to π/2 counter-clockwise.
    const first = primitiveCallsTo('arc')[0] ?? [];
    const [, x_px, y_px, radius_px, start_rad, end_rad, counterClockwise] = first;
    expect([x_px, y_px]).toEqual([WIDTH_PX / 2 + 0.6 * PX_PER_M, HEIGHT_PX / 2 - 0.25 * PX_PER_M]);
    expect(radius_px).toBe(0.25 * PX_PER_M);
    expect(start_rad).toBeCloseTo(Math.PI / 2, 10);
    expect(end_rad).toBeCloseTo(-Math.PI / 2, 10);
    expect(counterClockwise).toBe(true);
  });

  test('draws nothing for a track with no segments', () => {
    render(
      <Scene2D worldWidth_m={2} description="Pista">
        <TrackLayer track={{ segments: [], lineWidth_m: 0.02 }} />
      </Scene2D>,
    );
    flushFrames();

    expect(primitiveCallsTo('stroke')).toHaveLength(0);
  });
});
