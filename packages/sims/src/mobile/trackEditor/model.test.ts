import { describe, expect, it } from 'vitest';
import {
  PRESET_LINE_WIDTH_M,
  arcSweep_rad,
  oval,
  segmentLength_m,
  trackLength_m,
  type ArcSegment,
  type Vec2,
} from '@trayectoria/sim-core';
import {
  addArc,
  addLine,
  emptyEditor,
  moveEndpoint,
  removeSegment,
  segmentEndpoints,
  select,
  setLineWidth,
  setRadius,
} from './model';
import { continuity } from './continuity';

const ORIGIN: Vec2 = [0, 0];
const RIGHT: Vec2 = [0.2, 0];

function arcAt(state: ReturnType<typeof emptyEditor>, index: number): ArcSegment {
  const segment = state.track.segments[index];
  if (segment === undefined || segment.type !== 'arc') {
    throw new Error(`segment ${index} is not an arc`);
  }
  return segment;
}

describe('track editor model (F4-01a)', () => {
  it('starts empty with the preset line width and nothing selected', () => {
    const state = emptyEditor();
    expect(state.track.segments).toEqual([]);
    expect(state.track.lineWidth_m).toBe(PRESET_LINE_WIDTH_M);
    expect(state.selected).toBeNull();
  });

  it('adds a line segment without mutating the previous state', () => {
    const state = emptyEditor();
    const next = addLine(state, ORIGIN, RIGHT);
    expect(state.track.segments).toHaveLength(0);
    expect(next.track.segments).toEqual([{ type: 'line', from: ORIGIN, to: RIGHT }]);
    expect(next.selected).toBe(0);
  });

  it('places the centre of an arc from the chord and the radius', () => {
    const state = addArc(emptyEditor(), ORIGIN, RIGHT, 0.1, true);
    const arc = arcAt(state, 0);
    expect(arc.center[0]).toBeCloseTo(0.1, 12);
    expect(arc.center[1]).toBeCloseTo(0, 12);
    expect(arcSweep_rad(arc)).toBeCloseTo(Math.PI, 12);
    expect(segmentLength_m(arc)).toBeCloseTo(0.1 * Math.PI, 9);
  });

  it('clamps a radius shorter than half the chord to half the chord', () => {
    const state = addArc(emptyEditor(), ORIGIN, RIGHT, 0.05, true);
    const arc = arcAt(state, 0);
    expect(arc.radius_m).toBeCloseTo(0.1, 12);
    expect(arcSweep_rad(arc)).toBeCloseTo(Math.PI, 12);
    expect(segmentLength_m(arc)).toBeCloseTo(0.1 * Math.PI, 9);
  });

  it('keeps the endpoints when the radius changes and takes the minor arc', () => {
    const state = setRadius(addArc(emptyEditor(), ORIGIN, RIGHT, 0.1, true), 0, 0.15);
    const arc = arcAt(state, 0);
    const [from, to] = segmentEndpoints(arc);
    expect(from[0]).toBeCloseTo(ORIGIN[0], 9);
    expect(from[1]).toBeCloseTo(ORIGIN[1], 9);
    expect(to[0]).toBeCloseTo(RIGHT[0], 9);
    expect(to[1]).toBeCloseTo(RIGHT[1], 9);
    expect(segmentLength_m(arc)).toBeCloseTo(2 * 0.15 * Math.asin(0.1 / 0.15), 12);
  });

  it('sweeps clockwise on the other side of the chord when ccw is false', () => {
    const state = addArc(emptyEditor(), ORIGIN, RIGHT, 0.1, false);
    const arc = arcAt(state, 0);
    expect(arc.ccw).toBe(false);
    const [from, to] = segmentEndpoints(arc);
    expect(from[0]).toBeCloseTo(ORIGIN[0], 9);
    expect(to[0]).toBeCloseTo(RIGHT[0], 9);
    expect(segmentLength_m(arc)).toBeCloseTo(0.1 * Math.PI, 9);
  });

  it('ignores setRadius on a line and on an index out of range', () => {
    const line = addLine(emptyEditor(), ORIGIN, RIGHT);
    expect(setRadius(line, 0, 0.5)).toBe(line);
    expect(setRadius(line, 7, 0.5)).toBe(line);
  });

  it('moves the endpoint of a line and of an arc', () => {
    const line = moveEndpoint(addLine(emptyEditor(), ORIGIN, RIGHT), 0, 'to', [0.3, 0.1]);
    expect(line.track.segments[0]).toEqual({ type: 'line', from: ORIGIN, to: [0.3, 0.1] });

    const arc = arcAt(moveEndpoint(addArc(emptyEditor(), ORIGIN, RIGHT, 0.1, true), 0, 'from', [0, 0.1]), 0);
    const [from, to] = segmentEndpoints(arc);
    expect(from[0]).toBeCloseTo(0, 9);
    expect(from[1]).toBeCloseTo(0.1, 9);
    expect(to[0]).toBeCloseTo(RIGHT[0], 9);
    expect(to[1]).toBeCloseTo(RIGHT[1], 9);
  });

  it('ignores moveEndpoint on an index out of range', () => {
    const line = addLine(emptyEditor(), ORIGIN, RIGHT);
    expect(moveEndpoint(line, 3, 'to', [1, 1])).toBe(line);
  });

  it('removes a segment and clears or shifts the selection', () => {
    const two = addLine(addLine(emptyEditor(), ORIGIN, RIGHT), RIGHT, [0.4, 0]);
    const removed = removeSegment(two, 1);
    expect(removed.track.segments).toHaveLength(1);
    expect(removed.selected).toBeNull();
    expect(removeSegment(select(two, 1), 0).selected).toBe(0);
    expect(removeSegment(two, 9)).toBe(two);
  });

  it('sets the line width and the selection', () => {
    const state = setLineWidth(emptyEditor(), 0.03);
    expect(state.track.lineWidth_m).toBe(0.03);
    expect(select(state, null).selected).toBeNull();
    expect(select(addLine(state, ORIGIN, RIGHT), 0).selected).toBe(0);
    expect(select(state, 4).selected).toBeNull();
  });

  it('rebuilds the sim-core oval with the same length and no gaps', () => {
    const r_m = 0.25;
    let state = emptyEditor();
    state = addLine(state, [0, 0], [0.6, 0]);
    state = addArc(state, [0.6, 0], [0.6, 0.5], r_m, true);
    state = addLine(state, [0.6, 0.5], [0, 0.5]);
    state = addArc(state, [0, 0.5], [0, 0], r_m, true);

    expect(trackLength_m(state.track)).toBeCloseTo(trackLength_m(oval), 3);
    const result = continuity(state.track);
    expect(result.gaps).toEqual([]);
    expect(result.closed).toBe(true);
  });
});
