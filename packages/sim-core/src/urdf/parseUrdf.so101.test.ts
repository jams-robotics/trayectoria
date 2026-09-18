import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import type { DOMParserLike, UrdfDocument, UrdfResult } from './parseUrdf';
import { parseUrdf } from './parseUrdf';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../test/fixtures');

/** Node adapter for the browser `DOMParser`; xmldom is used only in tests. */
const domParser: DOMParserLike = {
  parseFromString(source: string): UrdfDocument {
    return new DOMParser().parseFromString(source, 'text/xml');
  },
};

const ROBOT_ID = '7d2e3b7e-6b2a-4c6e-9a5f-2b1c6a1f0003';

/** Parses a URDF file under `packages/sim-core/test/fixtures/`. */
function parseFixture(relativePath: string): UrdfResult {
  return parseUrdf(readFileSync(join(FIXTURES_DIR, relativePath), 'utf8'), {
    domParser,
    robotId: ROBOT_ID,
  });
}

// Counted from packages/sim-core/test/fixtures/so101/so101.urdf: 7 <joint> elements total,
// 1 of type "fixed" (gripper_frame_joint) and 6 of type "revolute" (shoulder_pan,
// shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper).
const SO101_NON_FIXED_JOINT_COUNT = 6;

describe('parseUrdf, SO-101 fixture (TheRobotStudio/SO-ARM100)', () => {
  const result = parseFixture('so101/so101.urdf');

  it('parses to a valid RobotSpec', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.kind).toBe('arm-serial');
  });

  it(`has ${SO101_NON_FIXED_JOINT_COUNT} non-fixed joints`, () => {
    if (!result.ok) throw new Error('the fixture must parse');
    const arm = result.value.arm;
    if (arm === undefined) throw new Error('the arm section is missing');
    const nonFixed = arm.joints.filter((joint) => joint.type !== 'fixed');
    expect(nonFixed).toHaveLength(SO101_NON_FIXED_JOINT_COUNT);
  });

  it('detects base_link as the root and the gripper link as the end effector', () => {
    if (!result.ok) throw new Error('the fixture must parse');
    const arm = result.value.arm;
    if (arm === undefined) throw new Error('the arm section is missing');
    expect(arm.baseLink).toBe('base_link');
    // No tool0/ee_link exists; docs/ROBOT-SPEC.md §2 falls back to the first leaf
    // link whose name starts with "gripper".
    expect(arm.endEffectorLink).toBe('gripper_frame_link');
  });

  it('resolves every mesh path as relative, without package://', () => {
    if (!result.ok) throw new Error('the fixture must parse');
    const arm = result.value.arm;
    if (arm === undefined) throw new Error('the arm section is missing');
    const meshPaths = arm.links
      .map((link) => link.visual?.meshPath)
      .filter((meshPath): meshPath is string => meshPath !== undefined);
    expect(meshPaths.length).toBeGreaterThan(0);
    for (const meshPath of meshPaths) {
      expect(meshPath.startsWith('package://')).toBe(false);
    }
  });
});
