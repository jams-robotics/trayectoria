import { describe, expect, it } from 'vitest';

import {
  CONE_RADIUS_M,
  FREE_LAYOUT,
  GOAL_RADIUS_M,
  ROBOT_RADIUS_M,
  collectGoals,
  resolveCollisions,
  separateRobots,
} from './freeArena';

const NONE = FREE_LAYOUT.goals.map(() => false);

describe('free arena layout', () => {
  it('leaves every goal reachable: inside the floor and clear of the cones', () => {
    for (const goal of FREE_LAYOUT.goals) {
      expect(resolveCollisions(FREE_LAYOUT, goal)).toEqual(goal);
      for (const cone of FREE_LAYOUT.cones) {
        const gap = Math.hypot(goal.x_m - cone.x_m, goal.y_m - cone.y_m);
        expect(gap).toBeGreaterThan(ROBOT_RADIUS_M + CONE_RADIUS_M + 0.02);
      }
    }
  });

  it('starts the robot free of cones', () => {
    expect(resolveCollisions(FREE_LAYOUT, FREE_LAYOUT.start)).toEqual({
      x_m: FREE_LAYOUT.start.x_m,
      y_m: FREE_LAYOUT.start.y_m,
    });
  });
});

describe('resolveCollisions', () => {
  it('pushes the robot out of a cone along the line through its centre', () => {
    const cone = FREE_LAYOUT.cones[0];
    if (cone === undefined) throw new Error('sin conos');
    const out = resolveCollisions(FREE_LAYOUT, { x_m: cone.x_m - 0.05, y_m: cone.y_m });
    expect(out.x_m).toBeCloseTo(cone.x_m - ROBOT_RADIUS_M - CONE_RADIUS_M, 9);
    expect(out.y_m).toBeCloseTo(cone.y_m, 9);
  });

  it('keeps a robot exactly on a cone centre out of it', () => {
    const cone = FREE_LAYOUT.cones[0];
    if (cone === undefined) throw new Error('sin conos');
    const out = resolveCollisions(FREE_LAYOUT, cone);
    expect(Math.hypot(out.x_m - cone.x_m, out.y_m - cone.y_m)).toBeCloseTo(0.14, 9);
  });

  it('stops the robot at the edges of the floor', () => {
    const out = resolveCollisions(FREE_LAYOUT, { x_m: 9, y_m: -9 });
    expect(out.x_m).toBeCloseTo(FREE_LAYOUT.halfWidth_m - ROBOT_RADIUS_M, 9);
    expect(out.y_m).toBeCloseTo(-(FREE_LAYOUT.halfHeight_m - ROBOT_RADIUS_M), 9);
  });
});

describe('collectGoals', () => {
  it('collects the goals the robot passes over, only those', () => {
    const goal = FREE_LAYOUT.goals[0];
    if (goal === undefined) throw new Error('sin metas');
    const next = collectGoals(FREE_LAYOUT, NONE, {
      x_m: goal.x_m + GOAL_RADIUS_M / 2,
      y_m: goal.y_m,
    });
    expect(next.filter(Boolean)).toHaveLength(1);
    expect(next[0]).toBe(true);
  });

  it('keeps a collected goal collected and returns the same array when nothing changed', () => {
    const done = [true, ...NONE.slice(1)];
    expect(collectGoals(FREE_LAYOUT, done, { x_m: 0, y_m: 0.9 })).toBe(done);
  });
});

describe('separateRobots', () => {
  it('leaves robots that do not touch where they are', () => {
    const a = { x_m: 0, y_m: 0 };
    const b = { x_m: 3 * ROBOT_RADIUS_M, y_m: 0 };
    expect(separateRobots(a, b)).toEqual([a, b]);
  });

  it('pushes overlapping robots apart by half the overlap each, until they only touch', () => {
    const [a, b] = separateRobots({ x_m: 0, y_m: 0 }, { x_m: ROBOT_RADIUS_M, y_m: 0 });
    expect(Math.hypot(b.x_m - a.x_m, b.y_m - a.y_m)).toBeCloseTo(2 * ROBOT_RADIUS_M, 9);
    expect(a.x_m).toBeCloseTo(-ROBOT_RADIUS_M / 2, 9);
    expect(b.x_m).toBeCloseTo(1.5 * ROBOT_RADIUS_M, 9);
  });

  it('separates robots on the very same spot', () => {
    const [a, b] = separateRobots({ x_m: 1, y_m: 1 }, { x_m: 1, y_m: 1 });
    expect(Math.hypot(b.x_m - a.x_m, b.y_m - a.y_m)).toBeCloseTo(2 * ROBOT_RADIUS_M, 9);
  });
});
