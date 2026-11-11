import { describe, expect, it } from 'vitest';

import type { Pose } from './compute';
import { fitView } from './scene';

const ORIGIN: Pose = { x_m: 0, y_m: 0, theta_rad: 0 };

describe('DiffDriveWidget fitView (v1.5)', () => {
  it('opens on the robot with room for its chassis and labels, so the chassis is about a fifth of the width', () => {
    const view = fitView(ORIGIN, []);
    expect(view.width_m).toBeCloseTo((2 * 0.25 * 16) / 9, 9);
    expect(view.centre_m).toEqual([0, 0]);
  });

  it('widens to hold the origin, the robot and its trace, and centres on all of them', () => {
    const view = fitView({ x_m: 1, y_m: 0, theta_rad: 0 }, [[0, 0], [0.5, 0], [1, 0]]);
    expect(view.width_m).toBeCloseTo(1 + 2 * 0.25, 9);
    expect(view.centre_m[0]).toBeCloseTo(0.5, 9);
  });

  it('stops widening at 2.4 m and follows the robot, which stays inside the view', () => {
    const pose: Pose = { x_m: 5, y_m: 0, theta_rad: 0 };
    const view = fitView(pose, [[0, 0], [5, 0]]);
    expect(view.width_m).toBe(2.4);
    expect(Math.abs(pose.x_m - view.centre_m[0])).toBeLessThanOrEqual(view.width_m / 2 - 0.25 + 1e-9);
  });

  it('a taller aspect asks for less width to hold the same height', () => {
    const pose: Pose = { x_m: 0, y_m: 1.2, theta_rad: 0 };
    expect(fitView(pose, [], 4 / 3).width_m).toBeLessThan(fitView(pose, []).width_m);
  });
});
