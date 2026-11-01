import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial } from 'three';

import { errorColor } from './palette';
import type { ArenaPalette } from './palette';
import { ribbonIndex, writeRibbon } from './trackMesh';

/** Points the trail keeps: at one every 1.5 cm, the last ~12 m travelled. */
const CAPACITY = 800;
/** Minimum distance between two trail points, in metres. */
const MIN_STEP_M = 0.015;
const WIDTH_M = 0.007;
const LIFT_M = 0.0012;

export interface Trail {
  readonly mesh: Mesh;
  /** Adds the robot position, coloured by how far from the centre the array saw the line. */
  push(x_m: number, y_m: number, error: number): void;
  clear(): void;
}

function ribbonMesh(positions: Float32Array, colors: Float32Array): Mesh<BufferGeometry> {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(ribbonIndex(CAPACITY));
  geometry.setDrawRange(0, 0);
  const material = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    side: DoubleSide,
    depthWrite: false,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * The path the robot left on the mat, coloured by the line error at each point: green where
 * it ran centred, red where it was about to lose the line. A tuned controller leaves a green
 * ribbon, an oscillating one a striped one.
 */
export function createTrail(palette: ArenaPalette, tint: Color | null = null): Trail {
  const positions = new Float32Array(CAPACITY * 6);
  const colors = new Float32Array(CAPACITY * 6);
  const mesh = ribbonMesh(positions, colors);
  const geometry = mesh.geometry;
  let points: Array<readonly [number, number]> = [];
  let errors: number[] = [];
  const color = new Color();
  const redraw = (): void => {
    writeRibbon(positions, points, WIDTH_M, LIFT_M);
    errors.forEach((error, i) => {
      if (tint === null) errorColor(palette, error, color);
      else color.copy(tint);
      colors.set([color.r, color.g, color.b, color.r, color.g, color.b], i * 6);
    });
    geometry.getAttribute('position').needsUpdate = true;
    geometry.getAttribute('color').needsUpdate = true;
    geometry.setDrawRange(0, Math.max(points.length - 1, 0) * 6);
  };
  return {
    mesh,
    push(x_m, y_m, error) {
      const last = points[points.length - 1];
      if (last !== undefined && Math.hypot(x_m - last[0], y_m - last[1]) < MIN_STEP_M) return;
      points.push([x_m, y_m]);
      errors.push(error);
      if (points.length > CAPACITY) {
        points = points.slice(-CAPACITY);
        errors = errors.slice(-CAPACITY);
      }
      redraw();
    },
    clear() {
      points = [];
      errors = [];
      geometry.setDrawRange(0, 0);
    },
  };
}
