import '@testing-library/jest-dom/vitest';
import { act, render } from '@testing-library/react';
import { sensorPositions } from '@trayectoria/sim-core';
import { referenceMobile } from '@trayectoria/robot-spec';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { Scene2D } from '../Scene2D';
import { RobotBody } from './RobotBody';

/** One recorded call to the 2D context: the method and the arguments it received. */
type Call = readonly [string, ...unknown[]];

/** Reference robot of docs/ROBOT-SPEC.md §3, already typed as the parsed spec. */
const REFERENCE = referenceMobile as RobotSpec;
const MOBILE: MobileSpec = REFERENCE.mobile as MobileSpec;

/** Golden view of the ticket: 800 px wide at 16/9 → 450 px tall, 2 m across → 400 px/m. */
const WIDTH_PX = 800;
const HEIGHT_PX = 450;
const PX_PER_M = WIDTH_PX / 2;

let calls: Call[];
let containerWidth_px = WIDTH_PX;

/**
 * Stub of `CanvasRenderingContext2D` that records every call: jsdom has no canvas backend, so
 * the primitives are checked by what they ask the context to draw (same harness as Scene2D.test).
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
    // `fillStyle` is recorded as a call too: a sensor's colour is set right before its `fill`,
    // so the sequence of assignments is what tells an «on» dot from an «off» one.
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

/** Calls recorded for one method, in order. */
function callsTo(name: string): Call[] {
  return calls.filter(([method]) => method === name);
}

/**
 * Same, without the calls of the scale bar: the scene always paints it last (docs/DESIGN.md §6),
 * so its strokes and caption would otherwise show up in every primitive's assertions.
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

describe('RobotBody (F2-02b)', () => {
  test('places the wheel centres at ±wheelBase_m/2 of the reference robot (golden value of F2-02b)', () => {
    render(
      <Scene2D worldWidth_m={2} description="Robot">
        <RobotBody spec={REFERENCE} pose={{ x_m: 0, y_m: 0, theta_rad: 0 }} />
      </Scene2D>,
    );
    flushFrames();

    // The body is drawn in its own frame: the origin is translated to the pose, so a local y of
    // ±offset_px lands at 225 ∓ 30 px on the 450 px canvas (golden value of the ticket).
    expect(callsTo('translate').at(-1)).toEqual(['translate', WIDTH_PX / 2, HEIGHT_PX / 2]);
    const offset_px = (MOBILE.wheelBase_m / 2) * PX_PER_M;
    expect(offset_px).toBe(30);

    const wheels = callsTo('rect');
    expect(wheels).toHaveLength(2);
    const diameter_px = 2 * MOBILE.wheelRadius_m * PX_PER_M;
    const thickness_px = diameter_px / 2;
    expect(wheels[0]).toEqual([
      'rect',
      -diameter_px / 2,
      -offset_px - thickness_px / 2,
      diameter_px,
      thickness_px,
    ]);
    expect(wheels[1]).toEqual([
      'rect',
      -diameter_px / 2,
      offset_px - thickness_px / 2,
      diameter_px,
      thickness_px,
    ]);
    // Wheel centres on the canvas: y = 225 ∓ 30 px, both at x = 400 px.
    const centres_px = wheels.map(
      ([, , y_px]) => HEIGHT_PX / 2 + Number(y_px) + thickness_px / 2,
    );
    expect(centres_px).toEqual([195, 255]);
  });

  test('draws one 5 px sensor dot per sensor of the spec, at the positions of sim-core', () => {
    render(
      <Scene2D worldWidth_m={2} description="Robot">
        <RobotBody spec={REFERENCE} pose={{ x_m: 0, y_m: 0, theta_rad: 0 }} />
      </Scene2D>,
    );
    flushFrames();

    const dots = callsTo('arc');
    expect(dots).toHaveLength(MOBILE.lineSensors.count);
    const expected = sensorPositions(MOBILE).map(([forward_m, lateral_m]) => [
      forward_m * PX_PER_M,
      -lateral_m * PX_PER_M,
    ]);
    expect(dots.map(([, x_px, y_px]) => [x_px, y_px])).toEqual(expected);
    for (const dot of dots) expect(dot[3]).toBe(5);
  });

  test('paints a sensor on or off by its flag, aligned by index', () => {
    const states = [false, true, true, false, false];
    render(
      <Scene2D worldWidth_m={2} description="Robot">
        <RobotBody
          spec={REFERENCE}
          pose={{ x_m: 0, y_m: 0, theta_rad: 0 }}
          sensorStates={states}
        />
      </Scene2D>,
    );
    flushFrames();

    // The fill style of a dot is set right before its `fill`: the last N assignments before the
    // scale bar are the sensors, in index order.
    const styles = primitiveCallsTo('fillStyle')
      .slice(-states.length)
      .map(([, value]) => value);
    const on = styles.filter((_value, index) => states[index] === true);
    const off = styles.filter((_value, index) => states[index] !== true);
    expect(new Set(on).size).toBe(1);
    expect(new Set(off).size).toBe(1);
    expect(on[0]).not.toBe(off[0]);
  });

  test('rotates the body by the heading, clockwise on the canvas', () => {
    render(
      <Scene2D worldWidth_m={2} description="Robot">
        <RobotBody spec={REFERENCE} pose={{ x_m: 0.25, y_m: -0.1, theta_rad: Math.PI / 2 }} />
      </Scene2D>,
    );
    flushFrames();

    expect(callsTo('translate').at(-1)).toEqual(['translate', 500, 265]);
    expect(callsTo('rotate').at(-1)).toEqual(['rotate', -Math.PI / 2]);
  });

  test('draws nothing when the spec carries no mobile profile', () => {
    const arm: RobotSpec = { ...REFERENCE, kind: 'arm-serial', mobile: undefined };
    render(
      <Scene2D worldWidth_m={2} description="Robot">
        <RobotBody spec={arm} pose={{ x_m: 0, y_m: 0, theta_rad: 0 }} />
      </Scene2D>,
    );
    flushFrames();

    expect(callsTo('rect')).toHaveLength(0);
    expect(callsTo('translate')).toHaveLength(0);
  });
});
