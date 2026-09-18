import { describe, expect, test } from 'vitest';

import { add3, cross3, distance3, dot3, length3, normalize3, scale3, sub3 } from './vec3';

describe('F1-03 vec3', () => {
  test('add3 and sub3 work component by component', () => {
    expect(add3([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(sub3([1, 2, 3], [4, 5, 6])).toEqual([-3, -3, -3]);
  });

  test('scale3 multiplies the three components', () => {
    expect(scale3([1, -2, 3], 2)).toEqual([2, -4, 6]);
  });

  test('dot3 matches a known value', () => {
    expect(dot3([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  test('cross3 follows the right-hand rule', () => {
    expect(cross3([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(cross3([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0]);
    expect(cross3([0, 0, 1], [1, 0, 0])).toEqual([0, 1, 0]);
  });

  test('length3 and distance3 match a known value', () => {
    expect(length3([2, 3, 6])).toBe(7);
    expect(distance3([1, 1, 1], [3, 4, 7])).toBe(7);
  });

  test('normalize3 returns a unit vector', () => {
    const [x, y, z] = normalize3([0, 0, 5]);
    expect([x, y, z]).toEqual([0, 0, 1]);
    expect(length3(normalize3([1, 2, 3]))).toBeCloseTo(1, 12);
  });

  test('normalize3 of the zero vector returns the zero vector', () => {
    expect(normalize3([0, 0, 0])).toEqual([0, 0, 0]);
  });

  test('inputs are not mutated', () => {
    const a: readonly [number, number, number] = [1, 2, 3];
    cross3(a, [0, 1, 0]);
    expect(a).toEqual([1, 2, 3]);
  });
});
