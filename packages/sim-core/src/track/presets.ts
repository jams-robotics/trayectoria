import type { Track, TrackSegment } from './Track';

/** Line width shared by every preset. */
export const PRESET_LINE_WIDTH_M = 0.02;

const OVAL_SEGMENTS: readonly TrackSegment[] = [
  { type: 'line', from: [0, 0], to: [0.6, 0] },
  {
    type: 'arc',
    center: [0.6, 0.25],
    radius_m: 0.25,
    startAngle_rad: -Math.PI / 2,
    endAngle_rad: Math.PI / 2,
    ccw: true,
  },
  { type: 'line', from: [0.6, 0.5], to: [0, 0.5] },
  {
    type: 'arc',
    center: [0, 0.25],
    radius_m: 0.25,
    startAngle_rad: Math.PI / 2,
    endAngle_rad: (3 * Math.PI) / 2,
    ccw: true,
  },
];

const S_CURVE_SEGMENTS: readonly TrackSegment[] = [
  { type: 'line', from: [0, 0], to: [0.3, 0] },
  {
    type: 'arc',
    center: [0.3, -0.2],
    radius_m: 0.2,
    startAngle_rad: Math.PI / 2,
    endAngle_rad: 0,
    ccw: false,
  },
  {
    type: 'arc',
    center: [0.7, -0.2],
    radius_m: 0.2,
    startAngle_rad: Math.PI,
    endAngle_rad: (3 * Math.PI) / 2,
    ccw: true,
  },
  { type: 'line', from: [0.7, -0.4], to: [1, -0.4] },
  {
    type: 'arc',
    center: [1, -0.2],
    radius_m: 0.2,
    startAngle_rad: -Math.PI / 2,
    endAngle_rad: Math.PI / 2,
    ccw: true,
  },
  { type: 'line', from: [1, 0], to: [0.7, 0] },
  {
    type: 'arc',
    center: [0.7, 0.2],
    radius_m: 0.2,
    startAngle_rad: -Math.PI / 2,
    endAngle_rad: -Math.PI,
    ccw: false,
  },
  {
    type: 'arc',
    center: [0.3, 0.2],
    radius_m: 0.2,
    startAngle_rad: 0,
    endAngle_rad: Math.PI / 2,
    ccw: true,
  },
  { type: 'line', from: [0.3, 0.4], to: [0, 0.4] },
  {
    type: 'arc',
    center: [0, 0.2],
    radius_m: 0.2,
    startAngle_rad: Math.PI / 2,
    endAngle_rad: (3 * Math.PI) / 2,
    ccw: true,
  },
];

const TIGHT_CURVES_SEGMENTS: readonly TrackSegment[] = [
  { type: 'line', from: [0, 0], to: [0.2, 0] },
  {
    type: 'arc',
    center: [0.2, 0.15],
    radius_m: 0.15,
    startAngle_rad: -Math.PI / 2,
    endAngle_rad: 0,
    ccw: true,
  },
  { type: 'line', from: [0.35, 0.15], to: [0.35, 0.35] },
  {
    type: 'arc',
    center: [0.2, 0.35],
    radius_m: 0.15,
    startAngle_rad: 0,
    endAngle_rad: Math.PI / 2,
    ccw: true,
  },
  { type: 'line', from: [0.2, 0.5], to: [0, 0.5] },
  {
    type: 'arc',
    center: [0, 0.35],
    radius_m: 0.15,
    startAngle_rad: Math.PI / 2,
    endAngle_rad: Math.PI,
    ccw: true,
  },
  { type: 'line', from: [-0.15, 0.35], to: [-0.15, 0.15] },
  {
    type: 'arc',
    center: [0, 0.15],
    radius_m: 0.15,
    startAngle_rad: Math.PI,
    endAngle_rad: (3 * Math.PI) / 2,
    ccw: true,
  },
];

const CROSSING_SEGMENTS: readonly TrackSegment[] = [
  { type: 'line', from: [0, 0], to: [0.4, 0] },
  {
    type: 'arc',
    center: [0.4, 0.2],
    radius_m: 0.2,
    startAngle_rad: -Math.PI / 2,
    endAngle_rad: Math.PI,
    ccw: true,
  },
  { type: 'line', from: [0.2, 0.2], to: [0.2, -0.2] },
  {
    type: 'arc',
    center: [0, -0.2],
    radius_m: 0.2,
    startAngle_rad: 0,
    endAngle_rad: (-3 * Math.PI) / 2,
    ccw: false,
  },
];

/** Closed oval: two 0.6 m straights joined by two 0.25 m semicircles. */
export const oval: Track = { segments: OVAL_SEGMENTS, lineWidth_m: PRESET_LINE_WIDTH_M };

/** Closed loop with two S-bends of radius 0.2 m. */
export const sCurve: Track = { segments: S_CURVE_SEGMENTS, lineWidth_m: PRESET_LINE_WIDTH_M };

/** Closed rounded rectangle whose four corners use the minimum radius of 0.15 m. */
export const tightCurves: Track = {
  segments: TIGHT_CURVES_SEGMENTS,
  lineWidth_m: PRESET_LINE_WIDTH_M,
};

/** Closed figure eight: the centerline crosses itself at (0.2, 0). */
export const crossing: Track = { segments: CROSSING_SEGMENTS, lineWidth_m: PRESET_LINE_WIDTH_M };

/** Every preset by name. */
export const presets = { oval, sCurve, tightCurves, crossing } as const;

/** Name of a built-in preset. */
export type PresetName = keyof typeof presets;
