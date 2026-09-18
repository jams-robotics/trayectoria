import type { ArmSpec } from '@trayectoria/robot-spec';
import { DOMParser } from '@xmldom/xmldom';
import { describe, expect, it } from 'vitest';

import type { DOMParserLike, UrdfDocument, UrdfResult } from './parseUrdf';
import { parseUrdf } from './parseUrdf';
import type { UrdfErrorCode } from './validate';

type Visual = NonNullable<ArmSpec['links'][number]['visual']>;
type Joint = ArmSpec['joints'][number];

/** Node adapter for the browser `DOMParser`; xmldom is used only in tests. */
const domParser: DOMParserLike = {
  parseFromString(source: string): UrdfDocument {
    return new DOMParser().parseFromString(source, 'text/xml');
  },
};

const ROBOT_ID = '7d2e3b7e-6b2a-4c6e-9a5f-2b1c6a1f0002';

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

describe('parseUrdf, mesh paths and primitives', () => {
  function visualOf(xml: string): Visual | undefined {
    const result = parseXml(xml);
    if (!result.ok) throw new Error(`debería parsear: ${JSON.stringify(codesOf(result))}`);
    return result.value.arm?.links[1]?.visual;
  }

  it('resolves package:// to the zip root', () => {
    const body = '<visual><geometry><mesh filename="package://mi_robot/meshes/l1.stl"/></geometry></visual>';
    expect(visualOf(robotWith(body))?.meshPath).toBe('meshes/l1.stl');
  });

  it('keeps a plain relative mesh path and strips a leading ./', () => {
    const body = '<visual><geometry><mesh filename="./meshes/l1.dae"/></geometry></visual>';
    expect(visualOf(robotWith(body))?.meshPath).toBe('meshes/l1.dae');
  });

  it('resolves a package:// url with no path to the root itself', () => {
    const body = '<visual><geometry><mesh filename="package://mi_robot"/></geometry></visual>';
    expect(visualOf(robotWith(body))?.meshPath).toBe('');
  });

  it('reads the mesh scale and defaults it to [1,1,1]', () => {
    const scaled = '<visual><geometry><mesh filename="a.stl" scale="0.1 0.2 0.3"/></geometry></visual>';
    expect(visualOf(robotWith(scaled))?.scale).toEqual([0.1, 0.2, 0.3]);
    const plain = '<visual><geometry><mesh filename="a.stl"/></geometry></visual>';
    expect(visualOf(robotWith(plain))?.scale).toEqual([1, 1, 1]);
  });

  it('ignores a malformed scale and falls back to [1,1,1]', () => {
    const body = '<visual><geometry><mesh filename="a.stl" scale="0.1 0.2"/></geometry></visual>';
    expect(visualOf(robotWith(body))?.scale).toEqual([1, 1, 1]);
  });

  it('reports missingMesh when filename is only whitespace', () => {
    const body = '<visual><geometry><mesh filename="   "/></geometry></visual>';
    expect(codesOf(parseXml(robotWith(body)))).toEqual(['missingMesh']);
  });

  it('reads a box primitive', () => {
    const body = '<visual><geometry><box size="0.1 0.2 0.3"/></geometry></visual>';
    expect(visualOf(robotWith(body))?.primitive).toEqual({
      type: 'box',
      size: [0.1, 0.2, 0.3],
    });
  });

  it('reads a sphere primitive', () => {
    const body = '<visual><geometry><sphere radius="0.05"/></geometry></visual>';
    expect(visualOf(robotWith(body))?.primitive).toEqual({ type: 'sphere', radius_m: 0.05 });
  });

  it('reads the visual origin and defaults it to zero', () => {
    const withOrigin =
      '<visual><origin xyz="0.1 0 0" rpy="0 1 0"/><geometry><sphere radius="0.05"/></geometry></visual>';
    expect(visualOf(robotWith(withOrigin))?.origin).toEqual({ xyz: [0.1, 0, 0], rpy: [0, 1, 0] });
    const plain = '<visual><geometry><sphere radius="0.05"/></geometry></visual>';
    expect(visualOf(robotWith(plain))?.origin).toEqual({ xyz: [0, 0, 0], rpy: [0, 0, 0] });
  });

  it('leaves the link without visual when there is no <visual> or no <geometry>', () => {
    expect(visualOf(robotWith(''))).toBeUndefined();
    expect(visualOf(robotWith('<visual/>'))).toBeUndefined();
  });

  it('leaves the link without visual when the geometry is unknown or malformed', () => {
    expect(visualOf(robotWith('<visual><geometry><capsule/></geometry></visual>'))).toBeUndefined();
    const brokenBox = '<visual><geometry><box/></geometry></visual>';
    expect(visualOf(robotWith(brokenBox))).toBeUndefined();
    const brokenCylinder = '<visual><geometry><cylinder radius="0.01"/></geometry></visual>';
    expect(visualOf(robotWith(brokenCylinder))).toBeUndefined();
    const brokenSphere = '<visual><geometry><sphere/></geometry></visual>';
    expect(visualOf(robotWith(brokenSphere))).toBeUndefined();
  });
});

describe('parseUrdf, joint attributes', () => {
  function jointOf(jointBody: string): Joint | undefined {
    const result = parseXml(robotWith('', jointBody));
    if (!result.ok) throw new Error(`debería parsear: ${JSON.stringify(codesOf(result))}`);
    return result.value.arm?.joints[0];
  }

  it('defaults the axis to [1,0,0] as URDF does', () => {
    expect(jointOf('')?.axis).toEqual([1, 0, 0]);
  });

  it('reads the declared axis', () => {
    expect(jointOf('<axis xyz="0 0 1"/>')?.axis).toEqual([0, 0, 1]);
  });

  it('ignores a malformed axis and falls back to the default', () => {
    expect(jointOf('<axis xyz="0 0"/>')?.axis).toEqual([1, 0, 0]);
    expect(jointOf('<axis xyz="0 0 abc"/>')?.axis).toEqual([1, 0, 0]);
  });

  it('defaults the joint origin to zero', () => {
    expect(jointOf('')?.origin).toEqual({ xyz: [0, 0, 0], rpy: [0, 0, 0] });
  });

  it('drops limits that do not declare both lower and upper', () => {
    expect(jointOf('<limit velocity="1.0"/>')?.limits).toBeUndefined();
    expect(jointOf('<limit lower="-1.0" effort="5"/>')?.limits).toBeUndefined();
  });

  it('keeps optional velocity and effort out when they are absent or malformed', () => {
    expect(jointOf('<limit lower="-1.0" upper="1.0"/>')?.limits).toEqual({
      lower: -1,
      upper: 1,
    });
    expect(jointOf('<limit lower="-1.0" upper="1.0" velocity="rapido"/>')?.limits).toEqual({
      lower: -1,
      upper: 1,
    });
  });

  it('treats a joint with no parent or child element as a missing link', () => {
    const xml = `<?xml version="1.0"?>
<robot name="prueba">
  <link name="base_link"/>
  <joint name="joint1" type="fixed"/>
</robot>`;
    expect(codesOf(parseXml(xml))).toEqual(['missingLink', 'missingLink']);
  });

  it('rejects planar joints as unsupported', () => {
    const xml = `<?xml version="1.0"?>
<robot name="prueba">
  <link name="base_link"/>
  <link name="link1"/>
  <joint name="joint1" type="planar">
    <parent link="base_link"/>
    <child link="link1"/>
  </joint>
</robot>`;
    const result = parseXml(xml);
    expect(codesOf(result)).toEqual(['unsupportedJoint']);
  });
});

describe('parseUrdf, end effector rule', () => {
  /** Chain base_link -> link1 -> ...extra leaves, so the rule can be exercised. */
  function chainWith(leafNames: readonly string[]): string {
    const links = ['base_link', ...leafNames].map((name) => `<link name="${name}"/>`).join('');
    const joints = leafNames
      .map(
        (name, index) =>
          `<joint name="j${String(index)}" type="fixed"><parent link="base_link"/><child link="${name}"/></joint>`,
      )
      .join('');
    return `<?xml version="1.0"?><robot name="prueba">${links}${joints}</robot>`;
  }

  function endEffectorOf(xml: string): string | undefined {
    const result = parseXml(xml);
    if (!result.ok) throw new Error(`debería parsear: ${JSON.stringify(codesOf(result))}`);
    return result.value.arm?.endEffectorLink;
  }

  it('prefers tool0 over any other leaf', () => {
    expect(endEffectorOf(chainWith(['otra', 'tool0', 'ee_link']))).toBe('tool0');
  });

  it('falls back to ee_link when there is no tool0', () => {
    expect(endEffectorOf(chainWith(['otra', 'ee_link']))).toBe('ee_link');
  });

  it('falls back to a gripper* leaf', () => {
    expect(endEffectorOf(chainWith(['otra', 'gripper_base']))).toBe('gripper_base');
  });

  it('falls back to the deepest leaf when no name matches', () => {
    const xml = `<?xml version="1.0"?><robot name="prueba">
  <link name="base_link"/><link name="a"/><link name="b"/><link name="c"/>
  <joint name="j0" type="fixed"><parent link="base_link"/><child link="a"/></joint>
  <joint name="j1" type="fixed"><parent link="base_link"/><child link="b"/></joint>
  <joint name="j2" type="fixed"><parent link="b"/><child link="c"/></joint>
</robot>`;
    expect(endEffectorOf(xml)).toBe('c');
  });

  it('uses the single link itself when the robot has no joints', () => {
    const xml = '<?xml version="1.0"?><robot name="prueba"><link name="base_link"/></robot>';
    expect(endEffectorOf(xml)).toBe('base_link');
  });
});
