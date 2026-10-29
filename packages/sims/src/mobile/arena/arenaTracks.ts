import { PRESET_LINE_WIDTH_M, presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

/** Tracks of the arena: the presets of sim-core plus a longer circuit with a chicane. */
export type ArenaTrackId = 'oval' | 's' | 'tight' | 'circuit';

export const ARENA_TRACK_IDS: readonly ArenaTrackId[] = ['circuit', 'oval', 's', 'tight'];

const HALF_PI = Math.PI / 2;

/**
 * «Gran circuito», about 5.9 m: a long straight, two quarter turns, a chicane of radius 0.2 m
 * and a wide hairpin back to the start. Every segment starts where the previous one ends and
 * with its heading, which `circuit closes` in the tests checks.
 */
export const circuit: Track = {
  lineWidth_m: PRESET_LINE_WIDTH_M,
  segments: [
    { type: 'line', from: [0, 0], to: [1.2, 0] },
    {
      type: 'arc',
      center: [1.2, 0.3],
      radius_m: 0.3,
      startAngle_rad: -HALF_PI,
      endAngle_rad: 0,
      ccw: true,
    },
    { type: 'line', from: [1.5, 0.3], to: [1.5, 0.6] },
    {
      type: 'arc',
      center: [1.2, 0.6],
      radius_m: 0.3,
      startAngle_rad: 0,
      endAngle_rad: HALF_PI,
      ccw: true,
    },
    { type: 'line', from: [1.2, 0.9], to: [0.9, 0.9] },
    {
      type: 'arc',
      center: [0.9, 1.1],
      radius_m: 0.2,
      startAngle_rad: -HALF_PI,
      endAngle_rad: -Math.PI,
      ccw: false,
    },
    {
      type: 'arc',
      center: [0.5, 1.1],
      radius_m: 0.2,
      startAngle_rad: 0,
      endAngle_rad: HALF_PI,
      ccw: true,
    },
    { type: 'line', from: [0.5, 1.3], to: [0, 1.3] },
    {
      type: 'arc',
      center: [0, 0.65],
      radius_m: 0.65,
      startAngle_rad: HALF_PI,
      endAngle_rad: 3 * HALF_PI,
      ccw: true,
    },
  ],
};

export const ARENA_TRACKS: Readonly<Record<ArenaTrackId, Track>> = {
  circuit,
  oval: presets.oval,
  s: presets.sCurve,
  tight: presets.tightCurves,
};
