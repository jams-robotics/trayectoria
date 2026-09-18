import { ArmSpec, planar2dof } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { endEffectorPose, forwardKinematics } from './forwardKinematics';

/** Planar 2-DoF arm of docs/ROBOT-SPEC.md §4, parsed so the schema defaults are applied. */
const planar = ArmSpec.parse(planar2dof.arm);

/** The acceptance criteria demand better than 1e-9 m on the golden poses. */
const TOLERANCE_M = 1e-9;

function expectPosition(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(3);
  expected.forEach((value, index) => {
    expect(actual[index] ?? Number.NaN).toBeCloseTo(value, 10);
    expect(Math.abs((actual[index] ?? Number.NaN) - value)).toBeLessThan(TOLERANCE_M);
  });
}

describe('forwardKinematics, planar 2-DoF golden values', () => {
  it('maps the base link to the identity', () => {
    const transforms = forwardKinematics(planar, [0, 0]);
    expect(transforms.get('base_link')).toEqual([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
  });

  it('returns one transform per link', () => {
    const transforms = forwardKinematics(planar, [0, 0]);
    expect([...transforms.keys()].sort()).toEqual(['base_link', 'link1', 'link2', 'tool0']);
  });

  it('stretches to (0.35, 0) at q = (0, 0)', () => {
    expectPosition(endEffectorPose(planar, [0, 0]).position_m, [0.35, 0, 0]);
  });

  it('points up to (0, 0.35) at q = (pi/2, 0)', () => {
    expectPosition(endEffectorPose(planar, [Math.PI / 2, 0]).position_m, [0, 0.35, 0]);
  });

  it('folds to (0.15, 0.20) at q = (pi/2, -pi/2)', () => {
    expectPosition(endEffectorPose(planar, [Math.PI / 2, -Math.PI / 2]).position_m, [0.15, 0.2, 0]);
  });

  it('places the elbow at the end of link1', () => {
    const transforms = forwardKinematics(planar, [Math.PI / 2, 0]);
    const elbow = transforms.get('link2');
    expect(elbow).toBeDefined();
    expectPosition(elbow === undefined ? [] : [elbow[12] ?? 0, elbow[13] ?? 0, elbow[14] ?? 0], [
      0, 0.2, 0,
    ]);
  });

  it('reports the yaw of the end effector as the sum of both joints', () => {
    const pose = endEffectorPose(planar, [Math.PI / 2, -Math.PI / 4]);
    expect(pose.rpy_rad[2]).toBeCloseTo(Math.PI / 4, 12);
    expect(pose.T).toHaveLength(16);
  });
});

/** Synthetic chain that exercises prismatic and fixed joints, declared out of tree order. */
const shuffled = ArmSpec.parse({
  baseLink: 'base',
  endEffectorLink: 'tip',
  links: [{ name: 'base' }, { name: 'slider' }, { name: 'wrist' }, { name: 'tip' }],
  joints: [
    {
      name: 'tip_joint',
      type: 'fixed',
      parent: 'wrist',
      child: 'tip',
      origin: { xyz: [0, 0, 0.05], rpy: [0, 0, 0] },
    },
    {
      name: 'wrist_joint',
      type: 'continuous',
      parent: 'slider',
      child: 'wrist',
      origin: { xyz: [0.1, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
    },
    {
      name: 'lift',
      type: 'prismatic',
      parent: 'base',
      child: 'slider',
      origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
      axis: [0, 0, 1],
      limits: { lower: 0, upper: 0.3 },
    },
  ],
});

describe('forwardKinematics, joint types and ordering', () => {
  it('walks the chain even when joints are declared out of order', () => {
    // q follows the declaration order of the non-fixed joints: wrist_joint, then lift.
    const pose = endEffectorPose(shuffled, [0, 0.2]);
    expectPosition(pose.position_m, [0.1, 0, 0.25]);
  });

  it('translates along the prismatic axis', () => {
    const a = endEffectorPose(shuffled, [0, 0]).position_m;
    const b = endEffectorPose(shuffled, [0, 0.3]).position_m;
    expect((b[2] ?? 0) - (a[2] ?? 0)).toBeCloseTo(0.3, 12);
  });

  it('rotates about the continuous axis and ignores its lack of limits', () => {
    const pose = endEffectorPose(shuffled, [Math.PI, 0]);
    expectPosition(pose.position_m, [0.1, 0, 0.05]);
    expect(() => endEffectorPose(shuffled, [10 * Math.PI, 0])).not.toThrow();
  });

  it('normalises a non-unit prismatic axis so q stays in metres', () => {
    const scaledAxis = ArmSpec.parse({
      baseLink: 'base',
      endEffectorLink: 'tip',
      links: [{ name: 'base' }, { name: 'tip' }],
      joints: [
        {
          name: 'lift',
          type: 'prismatic',
          parent: 'base',
          child: 'tip',
          origin: { xyz: [0, 0, 0], rpy: [0, 0, 0] },
          axis: [0, 0, 2],
          limits: { lower: 0, upper: 1 },
        },
      ],
    });
    expectPosition(endEffectorPose(scaledAxis, [0.4]).position_m, [0, 0, 0.4]);
  });

  it('treats a zero axis as no motion', () => {
    const zeroAxis = ArmSpec.parse({
      baseLink: 'base',
      endEffectorLink: 'tip',
      links: [{ name: 'base' }, { name: 'tip' }],
      joints: [
        {
          name: 'stuck',
          type: 'prismatic',
          parent: 'base',
          child: 'tip',
          origin: { xyz: [0.1, 0, 0], rpy: [0, 0, 0] },
          axis: [0, 0, 0],
          limits: { lower: -1, upper: 1 },
        },
      ],
    });
    expectPosition(endEffectorPose(zeroAxis, [0.5]).position_m, [0.1, 0, 0]);
  });

  it('branches when one link carries two joints', () => {
    const fork = ArmSpec.parse({
      baseLink: 'base',
      endEffectorLink: 'right',
      links: [{ name: 'base' }, { name: 'left' }, { name: 'right' }],
      joints: [
        {
          name: 'to_left',
          type: 'fixed',
          parent: 'base',
          child: 'left',
          origin: { xyz: [-0.1, 0, 0], rpy: [0, 0, 0] },
        },
        {
          name: 'to_right',
          type: 'fixed',
          parent: 'base',
          child: 'right',
          origin: { xyz: [0.1, 0, 0], rpy: [0, 0, 0] },
        },
      ],
    });
    const transforms = forwardKinematics(fork, []);
    const left = transforms.get('left');
    expect(left === undefined ? Number.NaN : (left[12] ?? Number.NaN)).toBeCloseTo(-0.1, 12);
    expectPosition(endEffectorPose(fork, []).position_m, [0.1, 0, 0]);
  });

  it('applies the rpy of the joint origin', () => {
    const tilted = ArmSpec.parse({
      baseLink: 'base',
      endEffectorLink: 'tip',
      links: [{ name: 'base' }, { name: 'tip' }],
      joints: [
        {
          name: 'tilt',
          type: 'fixed',
          parent: 'base',
          child: 'tip',
          origin: { xyz: [0, 0, 0], rpy: [0, 0, Math.PI / 2] },
        },
      ],
    });
    const pose = endEffectorPose(tilted, []);
    expect(pose.rpy_rad[2]).toBeCloseTo(Math.PI / 2, 12);
  });
});

describe('forwardKinematics, rejected configurations', () => {
  it('rejects a q of the wrong length', () => {
    expect(() => forwardKinematics(planar, [0])).toThrow(RangeError);
    expect(() => forwardKinematics(planar, [0, 0, 0])).toThrow(/2 articulaciones/);
  });

  it('rejects a value above the upper limit, naming the joint', () => {
    expect(() => forwardKinematics(planar, [0, 4])).toThrow(/joint2/);
  });

  it('rejects a value below the lower limit, naming the joint', () => {
    expect(() => forwardKinematics(planar, [-4, 0])).toThrow(/joint1/);
  });

  it('rejects NaN, naming the joint', () => {
    expect(() => forwardKinematics(planar, [Number.NaN, 0])).toThrow(/joint1/);
    expect(() => forwardKinematics(planar, [0, Number.POSITIVE_INFINITY])).toThrow(RangeError);
  });

  it('accepts a joint without declared limits', () => {
    const free = ArmSpec.parse({
      baseLink: 'base',
      endEffectorLink: 'tip',
      links: [{ name: 'base' }, { name: 'tip' }],
      joints: [
        {
          name: 'free',
          type: 'revolute',
          parent: 'base',
          child: 'tip',
          origin: { xyz: [0.1, 0, 0], rpy: [0, 0, 0] },
          axis: [0, 0, 1],
        },
      ],
    });
    expect(() => forwardKinematics(free, [100])).not.toThrow();
  });

  it('rejects a joint hanging from a link the base never reaches', () => {
    // Built without ArmSpec.parse: the schema rejects a disconnected chain, and this guards the
    // case where forwardKinematics is handed an arm that was never validated.
    const detached = {
      baseLink: 'base',
      endEffectorLink: 'tip',
      links: [{ name: 'base' }, { name: 'ghost' }, { name: 'tip' }],
      joints: [
        {
          name: 'orphan',
          type: 'revolute' as const,
          parent: 'ghost',
          child: 'tip',
          origin: { xyz: [0, 0, 0] as [number, number, number], rpy: [0, 0, 0] as [number, number, number] },
          axis: [0, 0, 1] as [number, number, number],
          limits: { lower: -1, upper: 1 },
        },
      ],
    };
    expect(() => forwardKinematics(detached, [0])).toThrow(/orphan/);
  });

  it('rejects an end effector link that is not in the arm', () => {
    const missingTip = { ...planar, endEffectorLink: 'nope' };
    expect(() => endEffectorPose(missingTip, [0, 0])).toThrow(/nope/);
  });
});
