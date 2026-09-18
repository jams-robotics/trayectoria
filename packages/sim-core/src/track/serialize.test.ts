import { describe, expect, it } from 'vitest';
import { presets } from './presets';
import { pointAt, trackLength_m, type Track } from './Track';
import { TRACK_FORMAT_VERSION, parseTrack, serializeTrack } from './serialize';

function expectOk(result: ReturnType<typeof parseTrack>): Track {
  if (!result.ok) {
    throw new Error(`expected a track, got: ${result.error}`);
  }
  return result.value;
}

describe('serializeTrack', () => {
  it('writes the schema version, the line width and the segments', () => {
    const json: unknown = JSON.parse(serializeTrack(presets.oval));
    expect(json).toMatchObject({ version: TRACK_FORMAT_VERSION, lineWidth_m: 0.02 });
    expect(TRACK_FORMAT_VERSION).toBe(1);
  });
});

describe('parseTrack', () => {
  it.each(Object.entries(presets))('round-trips %s into an equivalent track', (_name, track) => {
    const parsed = expectOk(parseTrack(serializeTrack(track)));
    expect(parsed.lineWidth_m).toBe(track.lineWidth_m);
    expect(parsed.segments).toEqual(track.segments);
    const length_m = trackLength_m(track);
    expect(trackLength_m(parsed)).toBeCloseTo(length_m, 12);
    for (let index = 0; index < 50; index += 1) {
      const s_m = (index * length_m) / 50;
      expect(pointAt(parsed, s_m)).toEqual(pointAt(track, s_m));
    }
  });

  it('rejects invalid JSON', () => {
    expect(parseTrack('{not json')).toEqual({ ok: false, error: 'invalid JSON' });
  });

  it('rejects an unknown version', () => {
    const result = parseTrack(JSON.stringify({ version: 2, lineWidth_m: 0.02, segments: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('unsupported version');
    }
  });

  it('rejects a missing version', () => {
    expect(parseTrack(JSON.stringify({ lineWidth_m: 0.02, segments: [] })).ok).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(parseTrack('[]').ok).toBe(false);
    expect(parseTrack('42').ok).toBe(false);
  });

  it('rejects a non-positive line width', () => {
    const result = parseTrack(JSON.stringify({ version: 1, lineWidth_m: 0, segments: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('lineWidth_m');
    }
  });

  it('rejects segments that are not an array', () => {
    expect(parseTrack(JSON.stringify({ version: 1, lineWidth_m: 0.02, segments: {} })).ok).toBe(
      false,
    );
  });

  it('rejects an unknown segment type', () => {
    const result = parseTrack(
      JSON.stringify({ version: 1, lineWidth_m: 0.02, segments: [{ type: 'spiral' }] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('segment 0');
    }
  });

  it('rejects a line segment with a malformed endpoint', () => {
    const result = parseTrack(
      JSON.stringify({
        version: 1,
        lineWidth_m: 0.02,
        segments: [{ type: 'line', from: [0, 0], to: [1] }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an arc with a non-positive radius', () => {
    const result = parseTrack(
      JSON.stringify({
        version: 1,
        lineWidth_m: 0.02,
        segments: [
          {
            type: 'arc',
            center: [0, 0],
            radius_m: -1,
            startAngle_rad: 0,
            endAngle_rad: 1,
            ccw: true,
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('radius_m');
    }
  });

  it('rejects an arc with a non-boolean ccw', () => {
    const result = parseTrack(
      JSON.stringify({
        version: 1,
        lineWidth_m: 0.02,
        segments: [
          {
            type: 'arc',
            center: [0, 0],
            radius_m: 1,
            startAngle_rad: 0,
            endAngle_rad: 1,
            ccw: 'yes',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('accepts an empty segment list', () => {
    const parsed = expectOk(
      parseTrack(JSON.stringify({ version: 1, lineWidth_m: 0.02, segments: [] })),
    );
    expect(parsed.segments).toEqual([]);
    expect(trackLength_m(parsed)).toBe(0);
  });
});
