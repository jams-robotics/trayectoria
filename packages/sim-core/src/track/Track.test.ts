import { describe, expect, it } from 'vitest';
import {
  arcSweep_rad,
  distanceToCenterline,
  pointAt,
  reflectance,
  segmentLength_m,
  trackLength_m,
  type ArcSegment,
  type Track,
} from './Track';

const straightTrack: Track = {
  segments: [{ type: 'line', from: [0, 0], to: [1, 0] }],
  lineWidth_m: 0.02,
};

describe('arcSweep_rad', () => {
  it('sweeps counter-clockwise from start to end', () => {
    const arc: ArcSegment = {
      type: 'arc',
      center: [0, 0],
      radius_m: 1,
      startAngle_rad: 0,
      endAngle_rad: Math.PI / 2,
      ccw: true,
    };
    expect(arcSweep_rad(arc)).toBeCloseTo(Math.PI / 2, 12);
  });

  it('sweeps the complementary angle when clockwise', () => {
    const arc: ArcSegment = {
      type: 'arc',
      center: [0, 0],
      radius_m: 1,
      startAngle_rad: 0,
      endAngle_rad: Math.PI / 2,
      ccw: false,
    };
    expect(arcSweep_rad(arc)).toBeCloseTo((3 * Math.PI) / 2, 12);
  });

  it('treats a coincident start and end as a full turn', () => {
    const arc: ArcSegment = {
      type: 'arc',
      center: [0, 0],
      radius_m: 1,
      startAngle_rad: Math.PI / 3,
      endAngle_rad: Math.PI / 3,
      ccw: true,
    };
    expect(arcSweep_rad(arc)).toBeCloseTo(2 * Math.PI, 12);
  });
});

describe('segmentLength_m', () => {
  it('measures a straight segment', () => {
    expect(segmentLength_m({ type: 'line', from: [0, 0], to: [3, 4] })).toBeCloseTo(5, 12);
  });

  it('measures a 180 degree arc of radius 0.15 m as the golden 0.4712 m', () => {
    const arc: ArcSegment = {
      type: 'arc',
      center: [0, 0],
      radius_m: 0.15,
      startAngle_rad: 0,
      endAngle_rad: Math.PI,
      ccw: true,
    };
    expect(segmentLength_m(arc)).toBeCloseTo(0.4712, 4);
    expect(segmentLength_m(arc)).toBeCloseTo(0.15 * Math.PI, 12);
  });
});

describe('trackLength_m', () => {
  it('adds up every segment', () => {
    const track: Track = {
      segments: [
        { type: 'line', from: [0, 0], to: [1, 0] },
        {
          type: 'arc',
          center: [1, 1],
          radius_m: 1,
          startAngle_rad: -Math.PI / 2,
          endAngle_rad: 0,
          ccw: true,
        },
      ],
      lineWidth_m: 0.02,
    };
    expect(trackLength_m(track)).toBeCloseTo(1 + Math.PI / 2, 12);
  });
});

describe('pointAt', () => {
  it('walks along a straight segment', () => {
    expect(pointAt(straightTrack, 0)[0]).toBeCloseTo(0, 12);
    expect(pointAt(straightTrack, 0.25)[0]).toBeCloseTo(0.25, 12);
    expect(pointAt(straightTrack, 0.999)[0]).toBeCloseTo(0.999, 12);
    // The whole length wraps back to the start: the track is a closed loop.
    expect(pointAt(straightTrack, 1)[0]).toBeCloseTo(0, 12);
  });

  it('wraps s modulo the total length', () => {
    const [x, y] = pointAt(straightTrack, 3.25);
    expect(x).toBeCloseTo(0.25, 12);
    expect(y).toBeCloseTo(0, 12);
    const [negativeX] = pointAt(straightTrack, -0.25);
    expect(negativeX).toBeCloseTo(0.75, 12);
  });

  it('walks counter-clockwise around an arc', () => {
    const track: Track = {
      segments: [
        {
          type: 'arc',
          center: [0, 0],
          radius_m: 1,
          startAngle_rad: 0,
          endAngle_rad: Math.PI / 2,
          ccw: true,
        },
      ],
      lineWidth_m: 0.02,
    };
    const [x, y] = pointAt(track, Math.PI / 4);
    expect(x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(y).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('walks clockwise around an arc', () => {
    const track: Track = {
      segments: [
        {
          type: 'arc',
          center: [0, 0],
          radius_m: 1,
          startAngle_rad: 0,
          endAngle_rad: -Math.PI / 2,
          ccw: false,
        },
      ],
      lineWidth_m: 0.02,
    };
    const [x, y] = pointAt(track, Math.PI / 4);
    expect(x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(y).toBeCloseTo(-Math.SQRT1_2, 12);
  });
});

describe('distanceToCenterline', () => {
  it('measures the perpendicular distance to a straight segment', () => {
    expect(distanceToCenterline(straightTrack, [0.5, 0.3])).toBeCloseTo(0.3, 12);
    expect(distanceToCenterline(straightTrack, [0.5, -0.3])).toBeCloseTo(0.3, 12);
  });

  it('clamps to the endpoints beyond a straight segment', () => {
    expect(distanceToCenterline(straightTrack, [-0.4, 0])).toBeCloseTo(0.4, 12);
    expect(distanceToCenterline(straightTrack, [1.3, 0.4])).toBeCloseTo(0.5, 12);
  });

  it('measures the radial distance inside an arc sweep', () => {
    const track: Track = {
      segments: [
        {
          type: 'arc',
          center: [0, 0],
          radius_m: 1,
          startAngle_rad: 0,
          endAngle_rad: Math.PI / 2,
          ccw: true,
        },
      ],
      lineWidth_m: 0.02,
    };
    expect(distanceToCenterline(track, [1.25, 0])).toBeCloseTo(0.25, 12);
    expect(distanceToCenterline(track, [0, 0.5])).toBeCloseTo(0.5, 12);
  });

  it('falls back to the closest endpoint outside an arc sweep', () => {
    const track: Track = {
      segments: [
        {
          type: 'arc',
          center: [0, 0],
          radius_m: 1,
          startAngle_rad: 0,
          endAngle_rad: Math.PI / 2,
          ccw: true,
        },
      ],
      lineWidth_m: 0.02,
    };
    // (-2, 0) is off the swept quarter, so the nearest point is the end (0, 1), at sqrt(5).
    expect(distanceToCenterline(track, [-2, 0])).toBeCloseTo(Math.sqrt(5), 12);
  });

  it('takes the minimum over every segment', () => {
    const track: Track = {
      segments: [
        { type: 'line', from: [0, 0], to: [1, 0] },
        { type: 'line', from: [0, 1], to: [1, 1] },
      ],
      lineWidth_m: 0.02,
    };
    expect(distanceToCenterline(track, [0.5, 0.8])).toBeCloseTo(0.2, 12);
  });
});

describe('reflectance', () => {
  const footprint_m = 0.004;
  const at = (distance_m: number): number =>
    reflectance(straightTrack, [0.5, distance_m], footprint_m);

  it('matches the golden values for lineWidth_m 0.02 and footprint_m 0.004', () => {
    expect(at(0)).toBeCloseTo(1, 12);
    expect(at(0.01)).toBeCloseTo(1, 12);
    expect(at(0.012)).toBeCloseTo(0.5, 12);
    expect(at(0.014)).toBeCloseTo(0, 12);
  });

  it('reads 1 at the centerline and 0 at lineWidth/2 + footprint', () => {
    expect(reflectance(straightTrack, pointAt(straightTrack, 0.4), footprint_m)).toBe(1);
    expect(at(straightTrack.lineWidth_m / 2 + footprint_m)).toBe(0);
  });

  it('stays inside [0, 1] and never rises with distance', () => {
    let previous = 1;
    for (let distance_m = 0; distance_m <= 0.03; distance_m += 0.0005) {
      const value = at(distance_m);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(previous + 1e-12);
      previous = value;
    }
  });

  it('is a step at the line edge when the footprint is a point', () => {
    expect(at(0.01)).toBe(1);
    expect(reflectance(straightTrack, [0.5, 0.0101], 0)).toBe(0);
  });
});
