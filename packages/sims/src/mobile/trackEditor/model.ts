import {
  PRESET_LINE_WIDTH_M,
  add2,
  distance2,
  scale2,
  sub2,
  type ArcSegment,
  type Track,
  type TrackSegment,
  type Vec2,
} from '@trayectoria/sim-core';

/** Which end of a segment an edit refers to. */
export type Endpoint = 'from' | 'to';

/** Track being edited plus the index of the selected segment, or `null` when nothing is selected. */
export interface EditorState {
  readonly track: Track;
  readonly selected: number | null;
}

/** An editor over an empty track of line width `lineWidth_m`, with nothing selected. */
export function emptyEditor(lineWidth_m: number = PRESET_LINE_WIDTH_M): EditorState {
  return { track: { segments: [], lineWidth_m }, selected: null };
}

/** Point where `segment` starts, in metres. */
function segmentStart(segment: TrackSegment): Vec2 {
  if (segment.type === 'line') {
    return segment.from;
  }
  return [
    segment.center[0] + segment.radius_m * Math.cos(segment.startAngle_rad),
    segment.center[1] + segment.radius_m * Math.sin(segment.startAngle_rad),
  ];
}

/** Point where `segment` ends, in metres. */
function segmentEnd(segment: TrackSegment): Vec2 {
  if (segment.type === 'line') {
    return segment.to;
  }
  return [
    segment.center[0] + segment.radius_m * Math.cos(segment.endAngle_rad),
    segment.center[1] + segment.radius_m * Math.sin(segment.endAngle_rad),
  ];
}

/** Both ends of `segment` as `[from, to]`, in metres. */
export function segmentEndpoints(segment: TrackSegment): readonly [Vec2, Vec2] {
  return [segmentStart(segment), segmentEnd(segment)];
}

/** Angle of `p` seen from `center`, in radians. */
function angleFrom_rad(center: Vec2, p: Vec2): number {
  return Math.atan2(p[1] - center[1], p[0] - center[0]);
}

/**
 * Arc of radius `radius_m` from `from` to `to`, swept counter-clockwise when `ccw` is true. The
 * centre sits on the perpendicular bisector of the chord, on the side that makes the sweep go the
 * requested way; a radius shorter than half the chord is clamped to half the chord (a semicircle),
 * and a longer one yields the minor arc.
 */
function arcThrough(from: Vec2, to: Vec2, radius_m: number, ccw: boolean): ArcSegment {
  const chord_m = distance2(from, to);
  const halfChord_m = chord_m / 2;
  const effectiveRadius_m = Math.max(Math.abs(radius_m), halfChord_m);
  const midpoint = scale2(add2(from, to), 0.5);
  const chord = sub2(to, from);
  // Unit normal to the chord, 90 deg counter-clockwise from it. A counter-clockwise sweep turns
  // left around a centre on that side, so the minor arc has its centre at `+normal`.
  const normal: Vec2 = chord_m === 0 ? [0, 0] : [-chord[1] / chord_m, chord[0] / chord_m];
  const offset_m = Math.sqrt(
    Math.max(effectiveRadius_m * effectiveRadius_m - halfChord_m * halfChord_m, 0),
  );
  const center = add2(midpoint, scale2(normal, ccw ? offset_m : -offset_m));
  return {
    type: 'arc',
    center,
    radius_m: effectiveRadius_m,
    startAngle_rad: angleFrom_rad(center, from),
    endAngle_rad: angleFrom_rad(center, to),
    ccw,
  };
}

/** Replaces segment `index` of `state`, keeping the selection. */
function withSegment(state: EditorState, index: number, segment: TrackSegment): EditorState {
  const segments = state.track.segments.map((current, i) => (i === index ? segment : current));
  return { track: { ...state.track, segments }, selected: state.selected };
}

/** Appends `segment` and selects it. */
function appendSegment(state: EditorState, segment: TrackSegment): EditorState {
  const segments = [...state.track.segments, segment];
  return { track: { ...state.track, segments }, selected: segments.length - 1 };
}

/** Adds a straight segment from `from` to `to` (metres) and selects it. */
export function addLine(state: EditorState, from: Vec2, to: Vec2): EditorState {
  return appendSegment(state, { type: 'line', from, to });
}

/** Adds an arc of radius `radius_m` from `from` to `to` (metres) and selects it. */
export function addArc(
  state: EditorState,
  from: Vec2,
  to: Vec2,
  radius_m: number,
  ccw: boolean,
): EditorState {
  return appendSegment(state, arcThrough(from, to, radius_m, ccw));
}

/** Changes the radius of the arc at `index` to `radius_m`, keeping both of its endpoints. */
export function setRadius(state: EditorState, index: number, radius_m: number): EditorState {
  const segment = state.track.segments[index];
  if (segment === undefined || segment.type !== 'arc') {
    return state;
  }
  const [from, to] = segmentEndpoints(segment);
  return withSegment(state, index, arcThrough(from, to, radius_m, segment.ccw));
}

/** Moves the `end` end of segment `index` to `p` (metres), keeping the other end and the radius. */
export function moveEndpoint(
  state: EditorState,
  index: number,
  end: Endpoint,
  p: Vec2,
): EditorState {
  const segment = state.track.segments[index];
  if (segment === undefined) {
    return state;
  }
  const [from, to] = segmentEndpoints(segment);
  const nextFrom = end === 'from' ? p : from;
  const nextTo = end === 'to' ? p : to;
  const next: TrackSegment =
    segment.type === 'line'
      ? { type: 'line', from: nextFrom, to: nextTo }
      : arcThrough(nextFrom, nextTo, segment.radius_m, segment.ccw);
  return withSegment(state, index, next);
}

/** Removes segment `index`; the selection follows it and is cleared when it pointed at it. */
export function removeSegment(state: EditorState, index: number): EditorState {
  if (state.track.segments[index] === undefined) {
    return state;
  }
  const segments = state.track.segments.filter((_, i) => i !== index);
  const selected =
    state.selected === null || state.selected === index
      ? null
      : state.selected - (state.selected > index ? 1 : 0);
  return { track: { ...state.track, segments }, selected };
}

/** Sets the painted line width to `w_m` metres. */
export function setLineWidth(state: EditorState, w_m: number): EditorState {
  return { track: { ...state.track, lineWidth_m: w_m }, selected: state.selected };
}

/** Selects segment `index`, or nothing when `index` is `null` or out of range. */
export function select(state: EditorState, index: number | null): EditorState {
  const selected = index !== null && state.track.segments[index] !== undefined ? index : null;
  return { track: state.track, selected };
}
