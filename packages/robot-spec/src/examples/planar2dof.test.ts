import { describe, expect, test } from 'vitest';

import { RobotSpec } from '../schema';
import { planar2dof } from './planar2dof';

describe('F1-01 planar 2-DoF arm (docs/ROBOT-SPEC.md §4)', () => {
  const arm = RobotSpec.parse(planar2dof).arm;
  if (arm === undefined) throw new Error('planar2dof has no arm section');

  test('is the catalog entry planar2dof', () => {
    expect(planar2dof.kind).toBe('arm-serial');
    expect(planar2dof.source).toEqual({ type: 'catalog', catalogId: 'planar2dof' });
  });

  test('has two revolute joints about Z with limits [-pi, pi]', () => {
    const revolute = arm.joints.filter((joint) => joint.type === 'revolute');
    expect(revolute.map((joint) => joint.name)).toEqual(['joint1', 'joint2']);
    for (const joint of revolute) {
      expect(joint.axis).toEqual([0, 0, 1]);
      expect(joint.limits).toEqual({ lower: -Math.PI, upper: Math.PI });
    }
  });

  test('link lengths l1 = 0.20 m and l2 = 0.15 m place joint2 and the end effector', () => {
    const joint2 = arm.joints.find((joint) => joint.name === 'joint2');
    const tool = arm.joints.find((joint) => joint.child === arm.endEffectorLink);
    expect(joint2?.parent).toBe('link1');
    expect(joint2?.origin.xyz).toEqual([0.2, 0, 0]);
    expect(tool?.type).toBe('fixed');
    expect(tool?.parent).toBe('link2');
    expect(tool?.origin.xyz).toEqual([0.15, 0, 0]);
  });

  test('links are cylinders of their own length, laid along X', () => {
    const link1 = arm.links.find((link) => link.name === 'link1');
    const link2 = arm.links.find((link) => link.name === 'link2');
    expect(link1?.visual?.primitive).toEqual({ type: 'cylinder', radius_m: 0.01, length_m: 0.2 });
    expect(link2?.visual?.primitive).toEqual({ type: 'cylinder', radius_m: 0.01, length_m: 0.15 });
    expect(link1?.visual?.origin).toEqual({ xyz: [0.1, 0, 0], rpy: [0, Math.PI / 2, 0] });
    expect(link2?.visual?.origin).toEqual({ xyz: [0.075, 0, 0], rpy: [0, Math.PI / 2, 0] });
  });

  test('base and end effector links exist and the chain is base_link -> link1 -> link2 -> tool0', () => {
    expect(arm.baseLink).toBe('base_link');
    expect(arm.endEffectorLink).toBe('tool0');
    expect(arm.links.map((link) => link.name)).toEqual(['base_link', 'link1', 'link2', 'tool0']);
    expect(arm.joints.map((joint) => `${joint.parent}->${joint.child}`)).toEqual([
      'base_link->link1',
      'link1->link2',
      'link2->tool0',
    ]);
  });
});
