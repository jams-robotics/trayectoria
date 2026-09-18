import { ArmSpec, planar2dof } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { jacobianNumeric } from './jacobianNumeric';

/** Planar 2-DoF arm of docs/ROBOT-SPEC.md §4, parsed so the schema defaults are applied. */
const planar = ArmSpec.parse(planar2dof.arm);

const TOLERANCE = 1e-6;

function expectColumn(
  J: readonly (readonly number[])[],
  column: number,
  expected: readonly [number, number, number],
): void {
  for (let row = 0; row < 3; row += 1) {
    const value = J[row]?.[column] ?? Number.NaN;
    expect(Math.abs(value - (expected[row] ?? 0))).toBeLessThan(TOLERANCE);
  }
}

describe('jacobianNumeric', () => {
  it('F1-08b golden: q = (0, 0) gives columns (0, 0.35, 0) and (0, 0.15, 0)', () => {
    const J = jacobianNumeric(planar, [0, 0]);
    expect(J).toHaveLength(3);
    J.forEach((row) => expect(row).toHaveLength(2));
    expectColumn(J, 0, [0, 0.35, 0]);
    expectColumn(J, 1, [0, 0.15, 0]);
  });

  it('F1-08b golden: one-sided difference when q_j + h leaves the joint limits', () => {
    const upperLimit = Math.PI;
    const centered = jacobianNumeric(planar, [upperLimit - 1e-3, 0]);
    const atLimit = jacobianNumeric(planar, [upperLimit, 0]);

    // The one-sided derivative at the limit should still be close to the interior, centered one.
    for (let row = 0; row < 3; row += 1) {
      const centeredValue = centered[row]?.[0] ?? Number.NaN;
      const atLimitValue = atLimit[row]?.[0] ?? Number.NaN;
      expect(Math.abs(atLimitValue - centeredValue)).toBeLessThan(1e-2);
    }
  });

  it('F1-08b: one-sided difference when q_j - h leaves the joint limits (lower bound)', () => {
    const lowerLimit = -Math.PI;
    const centered = jacobianNumeric(planar, [lowerLimit + 1e-3, 0]);
    const atLimit = jacobianNumeric(planar, [lowerLimit, 0]);

    for (let row = 0; row < 3; row += 1) {
      const centeredValue = centered[row]?.[0] ?? Number.NaN;
      const atLimitValue = atLimit[row]?.[0] ?? Number.NaN;
      expect(Math.abs(atLimitValue - centeredValue)).toBeLessThan(1e-2);
    }
  });

  it('uses the default step when h_rad is omitted', () => {
    const withDefault = jacobianNumeric(planar, [0, 0]);
    const withExplicit = jacobianNumeric(planar, [0, 0], 1e-6);
    expect(withDefault).toEqual(withExplicit);
  });
});
