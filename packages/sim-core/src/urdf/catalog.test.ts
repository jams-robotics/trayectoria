import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import { endEffectorPose } from '../arm/forwardKinematics';
import type { DOMParserLike, UrdfDocument, UrdfResult } from './parseUrdf';
import { parseUrdf } from './parseUrdf';

// The catalog lives outside the package (docs/ARCHITECTURE.md §2); apps/web cannot import
// sim-core, so the golden values of F5-05 are checked here against the same files the site
// serves (decision 7 of the assignment of #132).
const CATALOG_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../catalog/arms');

/** Node adapter for the browser `DOMParser`; xmldom is used only in tests. */
const domParser: DOMParserLike = {
  parseFromString(source: string): UrdfDocument {
    return new DOMParser().parseFromString(source, 'text/xml');
  },
};

const ROBOT_ID = '7d2e3b7e-6b2a-4c6e-9a5f-2b1c6a1f0005';

/** Parses a URDF file under `catalog/arms/`. */
function parseCatalogUrdf(relativePath: string): UrdfResult {
  return parseUrdf(readFileSync(join(CATALOG_DIR, relativePath), 'utf8'), {
    domParser,
    robotId: ROBOT_ID,
  });
}

/** The arm section of a parse that must have succeeded. */
function armOf(result: UrdfResult) {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const arm = result.value.arm;
  if (arm === undefined) throw new Error('the arm section is missing');
  return arm;
}

// Same count as the F1-09 fixture test: catalog/arms/so101/so101.urdf is the upstream
// so101_new_calib.urdf with the mesh directory renamed, so the kinematics are identical.
const SO101_NON_FIXED_JOINT_COUNT = 6;

describe('catalog/arms/so101', () => {
  const result = parseCatalogUrdf('so101/so101.urdf');

  it('parses to a valid RobotSpec', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.kind).toBe('arm-serial');
  });

  it(`has ${SO101_NON_FIXED_JOINT_COUNT} non-fixed joints, as the F1-09 fixture`, () => {
    const arm = armOf(result);
    const nonFixed = arm.joints.filter((joint) => joint.type !== 'fixed');
    expect(nonFixed).toHaveLength(SO101_NON_FIXED_JOINT_COUNT);
  });

  it('has the same joint count as the sim-core fixture of the same commit', () => {
    const fixturePath = join(
      dirname(fileURLToPath(import.meta.url)),
      '../../test/fixtures/so101/so101.urdf',
    );
    const fixture = parseUrdf(readFileSync(fixturePath, 'utf8'), { domParser, robotId: ROBOT_ID });
    expect(armOf(result).joints).toHaveLength(armOf(fixture).joints.length);
  });

  it('resolves every mesh path into the meshes/ directory of the catalog', () => {
    const arm = armOf(result);
    const meshPaths = arm.links
      .map((link) => link.visual?.meshPath)
      .filter((meshPath): meshPath is string => meshPath !== undefined);
    expect(meshPaths.length).toBeGreaterThan(0);
    for (const meshPath of meshPaths) {
      expect(meshPath.startsWith('meshes/')).toBe(true);
    }
  });

  it('points every mesh path at a file that exists', () => {
    const arm = armOf(result);
    const meshPaths = new Set(
      arm.links
        .map((link) => link.visual?.meshPath)
        .filter((meshPath): meshPath is string => meshPath !== undefined),
    );
    for (const meshPath of meshPaths) {
      expect(() => readFileSync(join(CATALOG_DIR, 'so101', meshPath))).not.toThrow();
    }
  });
});

describe('catalog/arms/planar2dof', () => {
  const result = parseCatalogUrdf('planar2dof/planar2dof.urdf');

  it('parses to a valid RobotSpec', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.value.kind).toBe('arm-serial');
  });

  it('has 2 actuated joints, base_link as the root and tool0 as the end effector', () => {
    const arm = armOf(result);
    const actuated = arm.joints.filter((joint) => joint.type !== 'fixed');
    expect(actuated).toHaveLength(2);
    expect(actuated.map((joint) => joint.name)).toEqual(['joint1', 'joint2']);
    expect(arm.baseLink).toBe('base_link');
    expect(arm.endEffectorLink).toBe('tool0');
  });

  it('uses primitive geometry only, with no mesh files', () => {
    const arm = armOf(result);
    for (const link of arm.links) {
      expect(link.visual?.meshPath).toBeUndefined();
    }
    const primitives = arm.links.filter((link) => link.visual?.primitive !== undefined);
    expect(primitives.length).toBeGreaterThan(0);
  });

  // Golden values of #132: l1 = 0.20 m, l2 = 0.15 m.
  const GOLDEN: readonly { q: readonly number[]; expected: readonly [number, number, number] }[] = [
    { q: [0, 0], expected: [0.35, 0, 0] },
    { q: [Math.PI / 2, 0], expected: [0, 0.35, 0] },
    { q: [Math.PI / 2, -Math.PI / 2], expected: [0.15, 0.2, 0] },
  ];

  it.each(GOLDEN)('places tool0 at $expected for q = $q', ({ q, expected }) => {
    const pose = endEffectorPose(armOf(result), q);
    expect(pose.position_m[0]).toBeCloseTo(expected[0], 9);
    expect(pose.position_m[1]).toBeCloseTo(expected[1], 9);
    expect(pose.position_m[2]).toBeCloseTo(expected[2], 9);
  });

  it('keeps the reach within 1e-9 of l1 + l2 for the extended arm', () => {
    const pose = endEffectorPose(armOf(result), [0, 0]);
    expect(Math.hypot(...pose.position_m)).toBeCloseTo(0.35, 9);
  });

  it('respects the joint limits of [-pi, pi]', () => {
    const arm = armOf(result);
    for (const joint of arm.joints.filter((candidate) => candidate.type !== 'fixed')) {
      expect(joint.limits?.lower).toBeCloseTo(-Math.PI, 9);
      expect(joint.limits?.upper).toBeCloseTo(Math.PI, 9);
    }
  });
});

describe('catalog/arms fichas', () => {
  it.each(['so101', 'planar2dof'])('%s declares an id equal to its directory', (id) => {
    const ficha: unknown = JSON.parse(readFileSync(join(CATALOG_DIR, id, 'ficha.json'), 'utf8'));
    expect(ficha).toMatchObject({ id });
  });

  it.each([
    { id: 'so101', urdf: 'so101/so101.urdf' },
    { id: 'planar2dof', urdf: 'planar2dof/planar2dof.urdf' },
  ])('$id declares the dof its URDF actuates', ({ id, urdf }) => {
    const ficha = JSON.parse(readFileSync(join(CATALOG_DIR, id, 'ficha.json'), 'utf8')) as {
      dof: number;
    };
    const actuated = armOf(parseCatalogUrdf(urdf)).joints.filter(
      (joint) => joint.type !== 'fixed',
    );
    expect(ficha.dof).toBe(actuated.length);
  });
});
