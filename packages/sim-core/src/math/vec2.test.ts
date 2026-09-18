import { describe, expect, test } from 'vitest';

import { add2, cross2, distance2, dot2, length2, normalize2, rotate2, scale2, sub2 } from './vec2';

describe('F1-03 vec2', () => {
  test('add2 and sub2 work component by component', () => {
    expect(add2([1, 2], [3, 4])).toEqual([4, 6]);
    expect(sub2([1, 2], [3, 4])).toEqual([-2, -2]);
  });

  test('scale2 multiplies both components', () => {
    expect(scale2([1, -2], 3)).toEqual([3, -6]);
  });

  test('dot2 and cross2 match known values', () => {
    expect(dot2([1, 0], [0, 1])).toBe(0);
    expect(dot2([1, 2], [3, 4])).toBe(11);
    expect(cross2([1, 0], [0, 1])).toBe(1);
    expect(cross2([0, 1], [1, 0])).toBe(-1);
  });

  test('length2 and distance2 match the 3-4-5 triangle', () => {
    expect(length2([3, 4])).toBe(5);
    expect(distance2([1, 1], [4, 5])).toBe(5);
  });

  test('normalize2 returns a unit vector in the same direction', () => {
    const [x, y] = normalize2([3, 4]);
    expect(x).toBeCloseTo(0.6, 12);
    expect(y).toBeCloseTo(0.8, 12);
  });

  test('normalize2 of the zero vector returns the zero vector', () => {
    expect(normalize2([0, 0])).toEqual([0, 0]);
  });

  test('rotate2 by 90 deg maps (1, 0) to (0, 1)', () => {
    const [x, y] = rotate2([1, 0], Math.PI / 2);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
  });

  test('rotate2 preserves length', () => {
    expect(length2(rotate2([3, 4], 0.7))).toBeCloseTo(5, 12);
  });

  test('inputs are not mutated', () => {
    const a: readonly [number, number] = [1, 2];
    add2(a, [3, 4]);
    expect(a).toEqual([1, 2]);
  });
});
