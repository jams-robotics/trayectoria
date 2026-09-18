import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import { endEffectorPose } from '../arm/forwardKinematics';
import type { DOMParserLike, UrdfDocument, UrdfResult } from './parseUrdf';
import { parseUrdf } from './parseUrdf';
import type { UrdfErrorCode } from './validate';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../test/fixtures');

/** Node adapter for the browser `DOMParser`; xmldom is used only in tests. */
const domParser: DOMParserLike = {
  parseFromString(source: string): UrdfDocument {
    return new DOMParser().parseFromString(source, 'text/xml');
  },
};

const ROBOT_ID = '7d2e3b7e-6b2a-4c6e-9a5f-2b1c6a1f0002';

/** Parses a URDF file under `packages/sim-core/test/fixtures/`. */
function parseFixture(relativePath: string): UrdfResult {
  return parseUrdf(readFileSync(join(FIXTURES_DIR, relativePath), 'utf8'), {
    domParser,
    robotId: ROBOT_ID,
  });
}

function parseXml(xml: string): UrdfResult {
  return parseUrdf(xml, { domParser, robotId: ROBOT_ID });
}

function codesOf(result: UrdfResult): readonly UrdfErrorCode[] {
  if (result.ok) throw new Error('se esperaba un fallo de parseo');
  return result.errors.map((error) => error.code);
}

/** Builds a minimal one-joint robot whose `<link name="link1">` carries `linkBody`. */
function robotWith(linkBody: string, jointBody = ''): string {
  return `<?xml version="1.0"?>
<robot name="prueba">
  <link name="base_link"/>
  <link name="link1">${linkBody}</link>
  <joint name="joint1" type="fixed">
    <parent link="base_link"/>
    <child link="link1"/>
    ${jointBody}
  </joint>
</robot>`;
}

describe('parseUrdf, planar2dof fixture', () => {
  const result = parseFixture('planar2dof/planar2dof.urdf');

  it('parses to a valid RobotSpec', () => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe('arm-serial');
    expect(result.value.id).toBe(ROBOT_ID);
    expect(result.value.source).toEqual({ type: 'urdf' });
    expect(result.value.specVersion).toBe(1);
    expect(result.value.name).toBe('Brazo plano 2 GDL');
  });

  it('extracts two revolute joints with l1 = 0.20 and l2 = 0.15', () => {
    if (!result.ok) throw new Error('el fixture debe parsear');
    const arm = result.value.arm;
    if (arm === undefined) throw new Error('falta la sección arm');
    const revolute = arm.joints.filter((joint) => joint.type === 'revolute');
    expect(revolute.map((joint) => joint.name)).toEqual(['joint1', 'joint2']);
    expect(arm.joints[1]?.origin.xyz).toEqual([0.2, 0, 0]);
    expect(arm.joints[2]?.origin.xyz).toEqual([0.15, 0, 0]);
    expect(revolute[0]?.limits).toEqual({
      lower: -Math.PI,
      upper: Math.PI,
      velocity: 2,
      effort: 10,
    });
  });

  it('detects base_link as the root and tool0 as the end effector', () => {
    if (!result.ok) throw new Error('el fixture debe parsear');
    expect(result.value.arm?.baseLink).toBe('base_link');
    expect(result.value.arm?.endEffectorLink).toBe('tool0');
  });

  it('ignores collision, inertial, transmission and gazebo', () => {
    if (!result.ok) throw new Error('el fixture debe parsear');
    const arm = result.value.arm;
    expect(arm?.links.map((link) => link.name)).toEqual([
      'base_link',
      'link1',
      'link2',
      'tool0',
    ]);
    expect(arm?.links[0]?.visual?.primitive).toEqual({
      type: 'cylinder',
      radius_m: 0.03,
      length_m: 0.02,
    });
  });

  it('reproduces the golden forward kinematics of F1-08a to better than 1e-9 m', () => {
    if (!result.ok) throw new Error('el fixture debe parsear');
    const arm = result.value.arm;
    if (arm === undefined) throw new Error('falta la sección arm');
    const cases: readonly [readonly number[], readonly number[]][] = [
      [[0, 0], [0.35, 0, 0]],
      [[Math.PI / 2, 0], [0, 0.35, 0]],
      [[Math.PI / 2, -Math.PI / 2], [0.15, 0.2, 0]],
    ];
    for (const [q_rad, expected_m] of cases) {
      const position_m = endEffectorPose(arm, q_rad).position_m;
      expected_m.forEach((value, index) => {
        expect(Math.abs((position_m[index] ?? Number.NaN) - value)).toBeLessThan(1e-9);
      });
    }
  });
});

describe('parseUrdf, invalid fixtures', () => {
  const expected: readonly [string, UrdfErrorCode][] = [
    ['parse.urdf', 'parse'],
    ['noRoot.urdf', 'noRoot'],
    ['multipleRoots.urdf', 'multipleRoots'],
    ['cycle.urdf', 'cycle'],
    ['missingLink.urdf', 'missingLink'],
    ['unsupportedJoint.urdf', 'unsupportedJoint'],
    ['missingMesh.urdf', 'missingMesh'],
    ['badLimits.urdf', 'badLimits'],
  ];

  it.each(expected)('%s produces the code %s', (file, code) => {
    const result = parseFixture(`invalid/${file}`);
    expect(result.ok).toBe(false);
    expect(codesOf(result)).toContain(code);
  });

  it('gives every error the i18n key urdf.<code>', () => {
    for (const [file] of expected) {
      const result = parseFixture(`invalid/${file}`);
      if (result.ok) throw new Error(`${file} debería fallar`);
      for (const error of result.errors) expect(error.key).toBe(`urdf.${error.code}`);
    }
  });

  it('names the affected joint in badLimits and unsupportedJoint', () => {
    const limits = parseFixture('invalid/badLimits.urdf');
    if (limits.ok) throw new Error('badLimits debería fallar');
    expect(limits.errors[0]?.detail).toBe('joint1');
    const unsupported = parseFixture('invalid/unsupportedJoint.urdf');
    if (unsupported.ok) throw new Error('unsupportedJoint debería fallar');
    expect(unsupported.errors[0]?.detail).toBe('joint1: floating');
  });

  it('names the affected link in missingMesh and missingLink', () => {
    const mesh = parseFixture('invalid/missingMesh.urdf');
    if (mesh.ok) throw new Error('missingMesh debería fallar');
    expect(mesh.errors[0]?.detail).toBe('link1');
    const missing = parseFixture('invalid/missingLink.urdf');
    if (missing.ok) throw new Error('missingLink debería fallar');
    expect(missing.errors[0]?.detail).toBe('link_fantasma');
  });
});

describe('parseUrdf, document level errors', () => {
  it('reports parse when the document has no <robot>', () => {
    expect(codesOf(parseXml('<?xml version="1.0"?><otro/>'))).toEqual(['parse']);
  });

  it('reports parse when the DOM implementation throws', () => {
    const throwing: DOMParserLike = {
      parseFromString(): UrdfDocument {
        throw new Error('implementación rota');
      },
    };
    const result = parseUrdf('<robot/>', { domParser: throwing, robotId: ROBOT_ID });
    if (result.ok) throw new Error('debería fallar');
    expect(result.errors[0]).toEqual({
      code: 'parse',
      key: 'urdf.parse',
      detail: 'implementación rota',
    });
  });

  it('reports parse with no detail when the thrown value is not an Error', () => {
    const throwing: DOMParserLike = {
      parseFromString(): UrdfDocument {
        // A broken DOM implementation may throw anything; the parser must survive it.
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'roto';
      },
    };
    const result = parseUrdf('<robot/>', { domParser: throwing, robotId: ROBOT_ID });
    if (result.ok) throw new Error('debería fallar');
    expect(result.errors[0]).toEqual({ code: 'parse', key: 'urdf.parse' });
  });

  it('maps a schema failure of parseRobotSpec to the parse code', () => {
    const result = parseUrdf(robotWith(''), { domParser, robotId: 'no-es-un-uuid' });
    if (result.ok) throw new Error('un id no UUID debería fallar');
    expect(result.errors[0]?.code).toBe('parse');
    expect(result.errors[0]?.detail).toContain('id');
  });

  it('skips nodes that are not elements in a collection', () => {
    const empty = { length: 1, item: (): unknown => null };
    const fake: DOMParserLike = {
      parseFromString(): UrdfDocument {
        return { getElementsByTagName: () => empty };
      },
    };
    expect(codesOf(parseUrdf('<robot/>', { domParser: fake, robotId: ROBOT_ID }))).toEqual([
      'parse',
    ]);
  });
});
