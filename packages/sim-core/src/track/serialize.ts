import type { ArcSegment, LineSegment, Track, TrackSegment } from './Track';
import type { Vec2 } from '../math/vec2';

/** Schema version written by `serializeTrack` and the only one `parseTrack` accepts. */
export const TRACK_FORMAT_VERSION = 1;

/** Outcome of a parse: either a value or the reason it could not be produced. */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/** Serializes `track` as JSON with its schema version. */
export function serializeTrack(track: Track): string {
  return JSON.stringify({
    version: TRACK_FORMAT_VERSION,
    lineWidth_m: track.lineWidth_m,
    segments: track.segments,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseVec2(value: unknown): Vec2 | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }
  const components: readonly unknown[] = value;
  const x = components[0];
  const y = components[1];
  return isFiniteNumber(x) && isFiniteNumber(y) ? [x, y] : null;
}

function parseLine(raw: Record<string, unknown>, index: number): Result<LineSegment, string> {
  const from = parseVec2(raw['from']);
  const to = parseVec2(raw['to']);
  if (from === null || to === null) {
    return { ok: false, error: `segment ${index}: "from" and "to" must be [x, y] pairs of finite numbers` };
  }
  return { ok: true, value: { type: 'line', from, to } };
}

function parseArc(raw: Record<string, unknown>, index: number): Result<ArcSegment, string> {
  const center = parseVec2(raw['center']);
  const radius_m = raw['radius_m'];
  const startAngle_rad = raw['startAngle_rad'];
  const endAngle_rad = raw['endAngle_rad'];
  const ccw = raw['ccw'];
  if (center === null) {
    return { ok: false, error: `segment ${index}: "center" must be an [x, y] pair of finite numbers` };
  }
  if (!isFiniteNumber(radius_m) || radius_m <= 0) {
    return { ok: false, error: `segment ${index}: "radius_m" must be a finite number greater than 0` };
  }
  if (!isFiniteNumber(startAngle_rad) || !isFiniteNumber(endAngle_rad)) {
    return { ok: false, error: `segment ${index}: "startAngle_rad" and "endAngle_rad" must be finite numbers` };
  }
  if (typeof ccw !== 'boolean') {
    return { ok: false, error: `segment ${index}: "ccw" must be a boolean` };
  }
  return { ok: true, value: { type: 'arc', center, radius_m, startAngle_rad, endAngle_rad, ccw } };
}

function parseSegment(value: unknown, index: number): Result<TrackSegment, string> {
  if (!isRecord(value)) {
    return { ok: false, error: `segment ${index}: expected an object` };
  }
  if (value['type'] === 'line') {
    return parseLine(value, index);
  }
  if (value['type'] === 'arc') {
    return parseArc(value, index);
  }
  return { ok: false, error: `segment ${index}: "type" must be "line" or "arc"` };
}

/**
 * Parses the JSON produced by `serializeTrack`. Invalid JSON, an unknown version or a malformed
 * segment all come back as an error rather than a throw.
 */
export function parseTrack(json: string): Result<Track, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: 'expected a JSON object' };
  }
  if (raw['version'] !== TRACK_FORMAT_VERSION) {
    return { ok: false, error: `unsupported version: ${JSON.stringify(raw['version'])}` };
  }
  const lineWidth_m = raw['lineWidth_m'];
  if (!isFiniteNumber(lineWidth_m) || lineWidth_m <= 0) {
    return { ok: false, error: '"lineWidth_m" must be a finite number greater than 0' };
  }
  const rawSegments = raw['segments'];
  if (!Array.isArray(rawSegments)) {
    return { ok: false, error: '"segments" must be an array' };
  }
  const segments: TrackSegment[] = [];
  for (let index = 0; index < rawSegments.length; index += 1) {
    const parsed = parseSegment(rawSegments[index], index);
    if (!parsed.ok) {
      return parsed;
    }
    segments.push(parsed.value);
  }
  return { ok: true, value: { segments, lineWidth_m } };
}
