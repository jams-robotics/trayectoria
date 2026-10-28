import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  NearestFilter,
} from 'three';
import { pointAt, trackLength_m } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

import type { ArenaPalette } from './palette';

/** Arc length between two samples of the drawn line, in metres. */
const SAMPLE_STEP_M = 0.005;
/** Border of the white mat around the line, in metres. */
export const MAT_MARGIN_M = 0.3;
/** Height of the painted line over the mat, so it never z-fights with it. */
const LINE_LIFT_M = 0.0006;
/** Length of the start strip across the line, in metres, and its checker cells. */
const START_STRIP_M = 0.09;
const START_CELLS = 6;

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Centerline of `track` sampled every `step_m`, closing on its first point. */
export function sampleTrack(
  track: Track,
  step_m = SAMPLE_STEP_M,
): Array<readonly [number, number]> {
  const length_m = trackLength_m(track);
  const count = Math.max(2, Math.ceil(length_m / step_m));
  const points: Array<readonly [number, number]> = [];
  for (let i = 0; i <= count; i += 1) points.push(pointAt(track, (length_m * i) / count));
  return points;
}

export function boundsOf(points: ReadonlyArray<readonly [number, number]>): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Writes a flat ribbon of `width_m` along `points` into `positions` (two vertices per point, at
 * height `z_m`). Shared by the painted line and the trail.
 */
export function writeRibbon(
  positions: Float32Array,
  points: ReadonlyArray<readonly [number, number]>,
  width_m: number,
  z_m: number,
): void {
  const half = width_m / 2;
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i] ?? [0, 0];
    const [ax, ay] = points[Math.max(i - 1, 0)] ?? [x, y];
    const [bx, by] = points[Math.min(i + 1, points.length - 1)] ?? [x, y];
    const dx = bx - ax;
    const dy = by - ay;
    const norm = Math.hypot(dx, dy) || 1;
    const nx = (-dy / norm) * half;
    const ny = (dx / norm) * half;
    positions.set([x + nx, y + ny, z_m, x - nx, y - ny, z_m], i * 6);
  }
}

/** Triangle indices of a ribbon of `count` points. */
export function ribbonIndex(count: number): number[] {
  const index: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return index;
}

function lineMesh(
  track: Track,
  points: ReadonlyArray<readonly [number, number]>,
  palette: ArenaPalette,
): Mesh {
  const positions = new Float32Array(points.length * 6);
  writeRibbon(positions, points, track.lineWidth_m, LINE_LIFT_M);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(ribbonIndex(points.length));
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({ color: palette.line, roughness: 0.9 });
  const mesh = new Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

/** A checkered strip across the start, the finish line of every lap. */
function startStrip(track: Track, palette: ArenaPalette): Mesh {
  const canvas = document.createElement('canvas');
  // Two cells along the track, `START_CELLS` across it.
  canvas.width = 16;
  canvas.height = START_CELLS * 8;
  const context = canvas.getContext('2d');
  for (let i = 0; i < START_CELLS * 2; i += 1) {
    const column = i % 2;
    const row = Math.floor(i / 2);
    if (context !== null) {
      context.fillStyle = `#${((column + row) % 2 === 0 ? palette.line : palette.mat).getHexString()}`;
      context.fillRect(column * 8, row * 8, 8, 8);
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.magFilter = NearestFilter;
  const geometry = new PlaneGeometry(0.02, START_STRIP_M);
  const strip = new Mesh(geometry, new MeshStandardMaterial({ map: texture, roughness: 0.8 }));
  const [x0, y0] = pointAt(track, 0);
  const [x1, y1] = pointAt(track, 0.001);
  strip.position.set(x0, y0, LINE_LIFT_M * 2);
  strip.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  return strip;
}

/** The white mat with the black line and the start strip; returns the group and its bounds. */
export function buildTrack(track: Track, palette: ArenaPalette): { group: Group; bounds: Bounds } {
  const points = sampleTrack(track);
  const bounds = boundsOf(points);
  const width_m = bounds.maxX - bounds.minX + 2 * MAT_MARGIN_M;
  const height_m = bounds.maxY - bounds.minY + 2 * MAT_MARGIN_M;
  const mat = new Mesh(
    new PlaneGeometry(width_m, height_m),
    new MeshStandardMaterial({ color: palette.mat, roughness: 0.85 }),
  );
  mat.position.set((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2, 0);
  mat.receiveShadow = true;
  const group = new Group();
  group.add(mat, lineMesh(track, points, palette), startStrip(track, palette));
  return { group, bounds };
}
