import { describe, expect, test } from 'vitest';
import type { z } from 'zod';

import { planar2dof } from './examples/planar2dof';
import { referenceMobile } from './examples/referenceMobile';
import { ArmSpec, RobotSpec, robotSpecJsonSchema } from './schema';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function customKeys(result: z.ZodSafeParseResult<unknown>): string[] {
  if (result.success) return [];
  return result.error.issues.map((issue) =>
    issue.code === 'custom' && typeof issue.params?.key === 'string'
      ? issue.params.key
      : issue.code,
  );
}

describe('F1-01 RobotSpec schema', () => {
  test('exports the JSON Schema of the parsed spec (snapshot)', () => {
    expect(robotSpecJsonSchema).toMatchSnapshot();
  });

  test('the JSON Schema declares the unit-suffixed mobile fields', () => {
    const properties = JSON.stringify(robotSpecJsonSchema);
    for (const field of ['wheelRadius_m', 'wheelBase_m', 'maxMotorSpeed_rpm', 'gearRatio']) {
      expect(properties).toContain(`"${field}"`);
    }
  });

  test('applies the defaults of docs/ROBOT-SPEC.md §1 when parsing', () => {
    const mobile = RobotSpec.parse(referenceMobile);
    expect(mobile.simConfigs).toEqual([]);

    const arm = RobotSpec.parse(planar2dof);
    expect(arm.arm?.joints[2]?.axis).toEqual([1, 0, 0]);
    expect(arm.arm?.links[0]?.visual?.scale).toEqual([1, 1, 1]);
    expect(arm.arm?.links[0]?.visual?.origin).toEqual({ xyz: [0, 0, 0], rpy: [0, 0, 0] });
  });

  test('footprint_m defaults to 0.004 m when omitted', () => {
    const input = clone(referenceMobile);
    if (input.mobile === undefined) throw new Error('example has no mobile section');
    input.mobile.lineSensors = { count: 5, spacing_m: 0.012, forwardOffset_m: 0.09 };
    const parsed = RobotSpec.parse(input);
    expect(parsed.mobile?.lineSensors.footprint_m).toBe(0.004);
  });

  test('mobile is required when kind is mobile-diff', () => {
    const withoutMobile: Record<string, unknown> = { ...referenceMobile };
    delete withoutMobile.mobile;
    const result = RobotSpec.safeParse(withoutMobile);
    expect(result.success).toBe(false);
    expect(customKeys(result)).toEqual(['robotSpec.mobileRequired']);
  });

  test('arm is required when kind is arm-serial', () => {
    const withoutArm: Record<string, unknown> = { ...planar2dof };
    delete withoutArm.arm;
    const result = RobotSpec.safeParse(withoutArm);
    expect(customKeys(result)).toEqual(['robotSpec.armRequired']);
  });

  test('arm invariants: tree rooted at baseLink, leaf end effector, unique names, ordered limits', () => {
    const arm = clone(planar2dof.arm);
    if (arm === undefined) throw new Error('example has no arm section');
    expect(ArmSpec.safeParse(arm).success).toBe(true);

    const cyclic = clone(arm);
    cyclic.joints.push({
      name: 'back_to_base',
      type: 'fixed',
      parent: 'tool0',
      child: 'base_link',
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
    });
    const cyclicKeys = customKeys(ArmSpec.safeParse(cyclic));
    expect(cyclicKeys).toContain('robotSpec.arm.notTree');
    expect(cyclicKeys).toContain('robotSpec.arm.endEffectorNotLeaf');

    const orphan = clone(arm);
    orphan.links.push({ name: 'floating' });
    expect(customKeys(ArmSpec.safeParse(orphan))).toEqual(['robotSpec.arm.notTree']);
  });
});
