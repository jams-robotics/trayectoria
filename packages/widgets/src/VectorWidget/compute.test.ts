import { describe, expect, test } from 'vitest';

import type { Vec2 } from '@trayectoria/sim-core';

import {
  VIEW_ASPECT,
  VIEW_CENTER,
  angleBetween,
  componentsOf,
  polarOf,
  readVectors,
  viewWidth,
} from './compute';

/** Tolerance of the golden values of the assignment of #86 (decision 2). */
const TOL = 1e-3;
/** Tighter tolerance the ticket asks for on angles in degrees. */
const TOL_DEG = 0.01;

describe('VectorWidget compute · golden values of T-0.2 (F2-03)', () => {
  test('components of v = 0.5 m/s at 30°: v_x = 0.433, v_y = 0.25', () => {
    const [vx_mps, vy_mps] = componentsOf(0.5, Math.PI / 6);
    expect(vx_mps).toBeCloseTo(0.433, 3);
    expect(vy_mps).toBeCloseTo(0.25, 3);
  });

  test('(0.3, 0.4) has magnitude 0.5 and angle 53.13°', () => {
    const polar = polarOf([0.3, 0.4]);
    expect(polar.magnitude).toBeCloseTo(0.5, 3);
    expect(polar.angle_deg).toBeCloseTo(53.13, 2);
    expect(Math.abs(polar.angle_deg - 53.13)).toBeLessThanOrEqual(TOL_DEG);
  });

  test('(1.2, 0.5) + (-0.4, 0.8) has magnitude 1.526', () => {
    const { sum_components, sum } = readVectors([1.2, 0.5], [-0.4, 0.8]);
    expect(sum_components).toEqual([0.7999999999999999, 1.3]);
    expect(sum.magnitude).toBeCloseTo(1.526, 3);
  });

  test('the angle between (0.3, 0.4) and (0.5, 0) is 53.13°', () => {
    const { between_deg } = readVectors([0.3, 0.4], [0.5, 0]);
    expect(Math.abs(between_deg - 53.13)).toBeLessThanOrEqual(TOL_DEG);
  });

  test('the dot product of perpendicular vectors is zero (experiment 3 of T-0.2)', () => {
    const { dot, between_deg } = readVectors([0.433, 0.25], [-0.25, 0.433]);
    expect(dot).toBeCloseTo(0, 6);
    expect(between_deg).toBeCloseTo(90, 3);
  });

  test('the sum of opposite vectors is zero (experiment 2 of T-0.2)', () => {
    const { sum } = readVectors([0.433, 0.25], [-0.433, -0.25]);
    expect(sum.magnitude).toBeLessThan(TOL);
  });
});

describe('VectorWidget compute · edge cases (F2-03)', () => {
  test('uses atan2, so the quadrant survives', () => {
    expect(polarOf([-0.3, -0.4]).angle_deg).toBeCloseTo(-126.87, 2);
    expect(polarOf([-0.3, 0.4]).angle_deg).toBeCloseTo(126.87, 2);
  });

  test('the angle against the zero vector is reported as zero, not NaN', () => {
    expect(angleBetween([0, 0], [0.5, 0])).toBe(0);
    expect(polarOf([0, 0]).magnitude).toBe(0);
  });

  test('parallel vectors give 0° and antiparallel ones 180° without float noise', () => {
    expect(angleBetween([0.3, 0.4], [0.6, 0.8])).toBeCloseTo(0, 6);
    expect(angleBetween([0.3, 0.4], [-0.6, -0.8]) * (180 / Math.PI)).toBeCloseTo(180, 6);
  });
});

/** Share of each half extent of the view a tip may reach, so it keeps a margin to grab it. */
const MAX_REACH_SHARE = 0.9;

/** True when the tip lies inside the view shrunk by the margin, on both axes. */
function insideWithMargin(tip: Vec2, width: number, aspect: number): boolean {
  const halfWidth = width / 2;
  const halfHeight = width / aspect / 2;
  return (
    Math.abs(tip[0] - VIEW_CENTER[0]) <= halfWidth * MAX_REACH_SHARE &&
    Math.abs(tip[1] - VIEW_CENTER[1]) <= halfHeight * MAX_REACH_SHARE
  );
}

describe('VectorWidget compute · view fit (#285)', () => {
  test.each<[Vec2, Vec2]>([
    [
      [0, 5],
      [0.3, -0.2],
    ],
    [
      [4, 4],
      [-3, 2],
    ],
    [
      [0, -5],
      [0.3, -0.2],
    ],
    [
      [0, -5],
      [0, 0],
    ],
  ])('a = %j, b = %j: the tips of a, b and a + b stay inside the view', (a, b) => {
    const tips = [a, b, readVectors(a, b).sum_components];
    const width = viewWidth(tips, VIEW_ASPECT);

    for (const tip of tips) {
      expect(insideWithMargin(tip, width, VIEW_ASPECT)).toBe(true);
    }
  });

  test('the hook, 0.5 m/s at 30°, keeps the view it had: 2.6 times the longest vector', () => {
    const a = componentsOf(0.5, Math.PI / 6);
    const alone: Vec2[] = [a, [0, 0], a];
    const explora: Vec2[] = [
      [0.433, 0.25],
      [0.2, -0.1],
      readVectors([0.433, 0.25], [0.2, -0.1]).sum_components,
    ];

    expect(viewWidth(alone, VIEW_ASPECT)).toBeCloseTo(1.3, 3);
    expect(viewWidth(explora, VIEW_ASPECT)).toBeCloseTo(1.691, 3);
  });
});
