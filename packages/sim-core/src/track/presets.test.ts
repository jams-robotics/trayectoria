import { describe, expect, it } from 'vitest';
import { distance2, type Vec2 } from '../math/vec2';
import { PRESET_LINE_WIDTH_M, crossing, oval, presets, sCurve, tightCurves } from './presets';
import { pointAt, reflectance, segmentLength_m, trackLength_m, type Track } from './Track';

/** Start point of a segment, used to check that each preset closes on itself. */
function segmentStart(track: Track, index: number): Vec2 {
  const segment = track.segments[index];
  if (segment === undefined) {
    throw new Error(`no segment at index ${index}`);
  }
  if (segment.type === 'line') {
    return segment.from;
  }
  return [
    segment.center[0] + segment.radius_m * Math.cos(segment.startAngle_rad),
    segment.center[1] + segment.radius_m * Math.sin(segment.startAngle_rad),
  ];
}

/** End point of the whole centerline. */
function trackEnd(track: Track): Vec2 {
  const last = track.segments[track.segments.length - 1];
  if (last === undefined) {
    throw new Error('empty track');
  }
  if (last.type === 'line') {
    return last.to;
  }
  const sweep_rad = segmentLength_m(last) / last.radius_m;
  const end_rad = last.ccw ? last.startAngle_rad + sweep_rad : last.startAngle_rad - sweep_rad;
  return [
    last.center[0] + last.radius_m * Math.cos(end_rad),
    last.center[1] + last.radius_m * Math.sin(end_rad),
  ];
}

const ANALYTIC_LENGTH_M: Record<keyof typeof presets, number> = {
  // 2 straights of 0.6 m + 2 semicircles of radius 0.25 m
  oval: 2 * 0.6 + 2 * Math.PI * 0.25,
  // 4 straights of 0.3 m + 4 quarter turns and 2 half turns of radius 0.2 m
  sCurve: 4 * 0.3 + (4 * (Math.PI / 2) + 2 * Math.PI) * 0.2,
  // 4 straights of 0.2 m + 4 quarter turns of radius 0.15 m
  tightCurves: 4 * 0.2 + 4 * (Math.PI / 2) * 0.15,
  // 2 straights of 0.4 m + 2 three-quarter turns of radius 0.2 m
  crossing: 2 * 0.4 + 2 * ((3 * Math.PI) / 2) * 0.2,
};

describe('presets', () => {
  it('exposes the four presets of the ticket', () => {
    expect(Object.keys(presets)).toEqual(['oval', 'sCurve', 'tightCurves', 'crossing']);
    expect(presets.oval).toBe(oval);
    expect(presets.sCurve).toBe(sCurve);
    expect(presets.tightCurves).toBe(tightCurves);
    expect(presets.crossing).toBe(crossing);
  });

  it.each(Object.entries(presets))('%s uses the shared line width', (_name, track) => {
    expect(track.lineWidth_m).toBe(PRESET_LINE_WIDTH_M);
    expect(track.lineWidth_m).toBe(0.02);
  });

  it.each(Object.entries(presets))('%s is a closed loop', (_name, track) => {
    expect(distance2(trackEnd(track), segmentStart(track, 0))).toBeLessThan(1e-9);
  });

  it.each(Object.entries(ANALYTIC_LENGTH_M))(
    '%s length_m matches the analytic value within 1 mm',
    (name, expected_m) => {
      const track = presets[name as keyof typeof presets];
      expect(Math.abs(trackLength_m(track) - expected_m)).toBeLessThan(0.001);
    },
  );

  it('has the expected closed-form lengths', () => {
    expect(trackLength_m(oval)).toBeCloseTo(1.2 + 0.5 * Math.PI, 12);
    expect(trackLength_m(sCurve)).toBeCloseTo(1.2 + 0.8 * Math.PI, 12);
    expect(trackLength_m(tightCurves)).toBeCloseTo(0.8 + 0.3 * Math.PI, 12);
    expect(trackLength_m(crossing)).toBeCloseTo(0.8 + 0.6 * Math.PI, 12);
  });

  it('keeps tightCurves at the minimum radius of 0.15 m', () => {
    const radii_m = tightCurves.segments
      .filter((segment) => segment.type === 'arc')
      .map((segment) => (segment.type === 'arc' ? segment.radius_m : 0));
    expect(radii_m).toHaveLength(4);
    for (const radius_m of radii_m) {
      expect(radius_m).toBeCloseTo(0.15, 12);
    }
  });

  it('crosses itself at (0.2, 0) in the crossing preset', () => {
    const crossingPoint: Vec2 = [0.2, 0];
    const length_m = trackLength_m(crossing);
    const visits_m: number[] = [];
    const steps = 4000;
    for (let index = 0; index < steps; index += 1) {
      const s_m = (index * length_m) / steps;
      if (distance2(pointAt(crossing, s_m), crossingPoint) < 0.001) {
        visits_m.push(s_m);
      }
    }
    // The centerline passes through the same point twice, far apart along the loop.
    expect(visits_m.length).toBeGreaterThan(1);
    const first_m = visits_m[0] ?? 0;
    const last_m = visits_m[visits_m.length - 1] ?? 0;
    expect(last_m - first_m).toBeGreaterThan(length_m / 4);
  });

  it.each(Object.entries(presets))('%s reads 1 all along its own centerline', (_name, track) => {
    const length_m = trackLength_m(track);
    for (let index = 0; index < 200; index += 1) {
      expect(reflectance(track, pointAt(track, (index * length_m) / 200), 0.004)).toBe(1);
    }
  });
});
