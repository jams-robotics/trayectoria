import {
  BoxGeometry,
  ConeGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from 'three';

import { CONE_RADIUS_M, GOAL_RADIUS_M } from '../freeArena';
import { CELL_M } from '../steps';
import type { FreeLayout } from '../freeArena';
import type { ArenaPalette } from './palette';
import type { Bounds } from './trackMesh';

const CONE_HEIGHT_M = 0.12;
const WALL_M = 0.02;
const WALL_HEIGHT_M = 0.04;
/** Height the goals float at, and the turns per second they spin at. */
const GOAL_LIFT_M = 0.07;
const SPIN_RPS = 0.4;
const STAR_POINTS = 5;
const STAR_INNER = 0.45;

/** A five-pointed star of outer radius `radius_m`, lying on the floor. */
function starGeometry(radius_m: number): ExtrudeGeometry {
  const shape = new Shape();
  for (let i = 0; i < STAR_POINTS * 2; i += 1) {
    const angle = (Math.PI * i) / STAR_POINTS + Math.PI / 2;
    const r = i % 2 === 0 ? radius_m : radius_m * STAR_INNER;
    if (i === 0) shape.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else shape.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  return new ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false });
}

function walls(layout: FreeLayout, palette: ArenaPalette): Mesh[] {
  const width_m = layout.halfWidth_m * 2;
  const height_m = layout.halfHeight_m * 2;
  const material = new MeshStandardMaterial({ color: palette.deck, roughness: 0.7 });
  const sides: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, layout.halfHeight_m, width_m + WALL_M, WALL_M],
    [0, -layout.halfHeight_m, width_m + WALL_M, WALL_M],
    [layout.halfWidth_m, 0, WALL_M, height_m],
    [-layout.halfWidth_m, 0, WALL_M, height_m],
  ];
  return sides.map(([x, y, w, h]) => {
    const wall = new Mesh(new BoxGeometry(w, h, WALL_HEIGHT_M), material);
    wall.position.set(x, y, WALL_HEIGHT_M / 2);
    wall.castShadow = true;
    return wall;
  });
}

/** Faint lines every `CELL_M` over the floor, for counting cells in the «Pasos» mode. */
function gridLines(layout: FreeLayout, palette: ArenaPalette): LineSegments {
  const points: number[] = [];
  const cellsX = Math.floor(layout.halfWidth_m / CELL_M);
  const cellsY = Math.floor(layout.halfHeight_m / CELL_M);
  for (let i = -cellsX; i <= cellsX; i += 1)
    points.push(i * CELL_M, -layout.halfHeight_m, 0, i * CELL_M, layout.halfHeight_m, 0);
  for (let j = -cellsY; j <= cellsY; j += 1)
    points.push(-layout.halfWidth_m, j * CELL_M, 0, layout.halfWidth_m, j * CELL_M, 0);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
  const lines = new LineSegments(
    geometry,
    new LineBasicMaterial({ color: palette.deck, transparent: true, opacity: 0.45 }),
  );
  lines.position.z = 0.002;
  return lines;
}

export interface FreeMesh {
  readonly group: Group;
  /** One star per goal of the layout, in the same order. */
  readonly goals: readonly Group[];
  readonly bounds: Bounds;
}

/** The open floor with its walls, the traffic cones and the stars of `layout`; `grid` adds the cell lines. */
export function buildFree(layout: FreeLayout, palette: ArenaPalette, grid = false): FreeMesh {
  const group = new Group();
  const floor = new Mesh(
    new PlaneGeometry(layout.halfWidth_m * 2, layout.halfHeight_m * 2),
    new MeshStandardMaterial({ color: palette.mat, roughness: 0.85 }),
  );
  floor.receiveShadow = true;
  const coneMaterial = new MeshStandardMaterial({ color: palette.bad, roughness: 0.6 });
  const cones = layout.cones.map((point) => {
    const cone = new Mesh(new ConeGeometry(CONE_RADIUS_M, CONE_HEIGHT_M, 24), coneMaterial);
    cone.rotation.x = Math.PI / 2;
    cone.position.set(point.x_m, point.y_m, CONE_HEIGHT_M / 2);
    cone.castShadow = true;
    return cone;
  });
  const starMaterial = new MeshStandardMaterial({
    color: palette.warn,
    emissive: palette.warn,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  const goals = layout.goals.map((point) => {
    const star = new Mesh(starGeometry(GOAL_RADIUS_M), starMaterial);
    star.rotation.x = Math.PI / 2;
    star.castShadow = true;
    // The pivot spins around the vertical while the star inside stands up.
    const pivot = new Group();
    pivot.position.set(point.x_m, point.y_m, GOAL_LIFT_M);
    pivot.add(star);
    return pivot;
  });
  group.add(floor, ...walls(layout, palette), ...cones, ...goals);
  if (grid) group.add(gridLines(layout, palette));
  const bounds = {
    minX: -layout.halfWidth_m,
    minY: -layout.halfHeight_m,
    maxX: layout.halfWidth_m,
    maxY: layout.halfHeight_m,
  };
  return { group, goals, bounds };
}

/** Hides the collected stars and spins the rest, `t_s` being the simulated time. */
export function animateGoals(
  goals: readonly Group[],
  collected: readonly boolean[],
  t_s: number,
): void {
  goals.forEach((star, i) => {
    star.visible = collected[i] !== true;
    star.rotation.z = t_s * SPIN_RPS * Math.PI * 2;
  });
}
