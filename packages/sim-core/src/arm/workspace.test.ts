import { ArmSpec, planar2dof } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { sampleWorkspace } from './workspace';
import { createRng } from '../random/SeededRng';

/** Planar 2-DoF arm of docs/ROBOT-SPEC.md §4, parsed so the schema defaults are applied. */
const planar = ArmSpec.parse(planar2dof.arm);

const REACH_M = 0.2 + 0.15;

describe('sampleWorkspace', () => {
  it('F1-08b golden: same seed yields the same points', () => {
    const a = sampleWorkspace(planar, 50, createRng(42));
    const b = sampleWorkspace(planar, 50, createRng(42));
    expect(a).toEqual(b);
  });

  it('F1-08b golden: every sampled point stays within reach l1 + l2', () => {
    const points = sampleWorkspace(planar, 200, createRng(7));
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i] ?? 0;
      const y = points[i + 1] ?? 0;
      const z = points[i + 2] ?? 0;
      const distance = Math.hypot(x, y, z);
      expect(distance).toBeLessThanOrEqual(REACH_M + 1e-6);
    }
  });

  it('returns length 3n, and n = 0 gives an empty array', () => {
    expect(sampleWorkspace(planar, 5, createRng(1))).toHaveLength(15);
    expect(sampleWorkspace(planar, 0, createRng(1))).toHaveLength(0);
  });

  it('rejects a non-integer n', () => {
    expect(() => sampleWorkspace(planar, 1.5, createRng(1))).toThrow(RangeError);
  });

  it('rejects a negative n', () => {
    expect(() => sampleWorkspace(planar, -1, createRng(1))).toThrow(RangeError);
  });
});
