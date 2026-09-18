import { describe, expect, test } from 'vitest';

import { parseRobotSpec, planar2dof, referenceMobile } from './index';
import type { ValidationError } from './index';

const RPM_TO_RADPS = (2 * Math.PI) / 60;

/** Deep copy of `base` with the value at `path` replaced (or deleted when `value` is undefined). */
function withValue(base: unknown, path: string[], value: unknown): unknown {
  const root = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  let node = root;
  for (const segment of path.slice(0, -1)) {
    node = node[segment] as Record<string, unknown>;
  }
  const last = path.at(-1) as string;
  if (value === undefined) delete node[last];
  else node[last] = value;
  return root;
}

function errorsOf(input: unknown): readonly ValidationError[] {
  const result = parseRobotSpec(input);
  if (result.ok) throw new Error('expected the spec to be rejected');
  return result.errors;
}

describe('F1-01 parseRobotSpec', () => {
  test('accepts the reference mobile robot (docs/ROBOT-SPEC.md §3)', () => {
    const result = parseRobotSpec(referenceMobile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe('mobile-diff');
      expect(result.value.mobile?.wheelRadius_m).toBe(0.032);
      expect(result.value.simConfigs).toEqual([]);
    }
  });

  test('accepts the planar 2-DoF arm (docs/ROBOT-SPEC.md §4)', () => {
    const result = parseRobotSpec(planar2dof);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.arm?.joints).toHaveLength(3);
      expect(result.value.arm?.endEffectorLink).toBe('tool0');
    }
  });

  test('golden values derive from the parsed mobile example', () => {
    const result = parseRobotSpec(referenceMobile);
    if (!result.ok || result.value.mobile === undefined) throw new Error('example rejected');
    const { maxMotorSpeed_rpm, gearRatio, wheelRadius_m } = result.value.mobile;
    const omegaMax_radps = (maxMotorSpeed_rpm * RPM_TO_RADPS) / gearRatio;
    const vMax_mps = omegaMax_radps * wheelRadius_m;
    expect(omegaMax_radps).toBeCloseTo(20.944, 3);
    expect(vMax_mps).toBeCloseTo(0.67, 3);
  });

  test('a non-object input is rejected with robotSpec.invalidType', () => {
    expect(errorsOf('robot')).toEqual([
      { path: '', key: 'robotSpec.invalidType', message: 'Tipo inválido: se esperaba un objeto' },
    ]);
  });

  const invalidCases: [string, unknown, string, string][] = [
    [
      'missing specVersion',
      withValue(referenceMobile, ['specVersion'], undefined),
      'specVersion',
      'robotSpec.required',
    ],
    [
      'unknown specVersion',
      withValue(referenceMobile, ['specVersion'], 2),
      'specVersion',
      'robotSpec.invalidValue',
    ],
    [
      'malformed id',
      withValue(referenceMobile, ['id'], 'not-a-uuid'),
      'id',
      'robotSpec.invalidFormat',
    ],
    ['empty name', withValue(referenceMobile, ['name'], ''), 'name', 'robotSpec.tooSmall'],
    [
      'unknown kind',
      withValue(referenceMobile, ['kind'], 'humanoid'),
      'kind',
      'robotSpec.invalidValue',
    ],
    [
      'verifiedAt not ISO',
      withValue(referenceMobile, ['source', 'verifiedAt'], 'ayer'),
      'source.verifiedAt',
      'robotSpec.invalidFormat',
    ],
    [
      'wheel radius below 5 mm',
      withValue(referenceMobile, ['mobile', 'wheelRadius_m'], 0.001),
      'mobile.wheelRadius_m',
      'robotSpec.tooSmall',
    ],
    [
      'motor speed above 30000 rpm',
      withValue(referenceMobile, ['mobile', 'maxMotorSpeed_rpm'], 40000),
      'mobile.maxMotorSpeed_rpm',
      'robotSpec.tooBig',
    ],
    [
      'fractional encoder ticks',
      withValue(referenceMobile, ['mobile', 'encoderTicksPerRev'], 12.5),
      'mobile.encoderTicksPerRev',
      'robotSpec.notInteger',
    ],
    [
      'wheel radius as text',
      withValue(referenceMobile, ['mobile', 'wheelRadius_m'], '0.032'),
      'mobile.wheelRadius_m',
      'robotSpec.invalidType',
    ],
    [
      'missing sensor count',
      withValue(referenceMobile, ['mobile', 'lineSensors', 'count'], undefined),
      'mobile.lineSensors.count',
      'robotSpec.required',
    ],
    [
      'mobile-diff without mobile',
      withValue(referenceMobile, ['mobile'], undefined),
      'mobile',
      'robotSpec.mobileRequired',
    ],
    [
      'arm-serial without arm',
      withValue(planar2dof, ['arm'], undefined),
      'arm',
      'robotSpec.armRequired',
    ],
    [
      'joint child not a link',
      withValue(planar2dof, ['arm', 'joints', '2', 'child'], 'tool1'),
      'arm.joints[2].child',
      'robotSpec.arm.unknownLink',
    ],
    [
      'duplicate link name',
      withValue(planar2dof, ['arm', 'links', '3', 'name'], 'link1'),
      'arm.links[3].name',
      'robotSpec.arm.duplicateLinkName',
    ],
    [
      'end effector with children',
      withValue(planar2dof, ['arm', 'endEffectorLink'], 'link1'),
      'arm.endEffectorLink',
      'robotSpec.arm.endEffectorNotLeaf',
    ],
    [
      'missing end effector link',
      withValue(planar2dof, ['arm', 'endEffectorLink'], 'gripper'),
      'arm.endEffectorLink',
      'robotSpec.arm.endEffectorMissing',
    ],
    [
      'lower >= upper',
      withValue(planar2dof, ['arm', 'joints', '0', 'limits'], { lower: 1, upper: -1 }),
      'arm.joints[0].limits',
      'robotSpec.arm.badLimits',
    ],
    [
      'base link as a child',
      withValue(planar2dof, ['arm', 'joints', '2', 'child'], 'base_link'),
      'arm.joints',
      'robotSpec.arm.notTree',
    ],
    [
      'unknown primitive',
      withValue(planar2dof, ['arm', 'links', '0', 'visual', 'primitive'], { type: 'cone' }),
      'arm.links[0].visual.primitive.type',
      'robotSpec.invalidUnion',
    ],
    [
      'non-numeric sim param',
      withValue(
        referenceMobile,
        ['simConfigs'],
        [{ id: 'a', name: 'A', controller: 'pid', params: { Kp: 'x' }, seed: 1 }],
      ),
      'simConfigs[0].params.Kp',
      'robotSpec.invalidType',
    ],
    [
      'infinite joint limit',
      withValue(planar2dof, ['arm', 'joints', '0', 'limits'], {
        lower: -Infinity,
        upper: Infinity,
      }),
      'arm.joints[0].limits.lower',
      'robotSpec.invalidType',
    ],
  ];

  test.each(invalidCases)(
    'rejects %s with the expected key and path',
    (_name, input, path, key) => {
      const errors = errorsOf(input);
      expect(errors).toContainEqual(expect.objectContaining({ path, key }));
      for (const error of errors) {
        expect(error.key).toMatch(/^robotSpec\./);
        expect(error.message).not.toBe('');
      }
    },
  );

  test('messages are readable Spanish with the bound in the text', () => {
    const [error] = errorsOf(withValue(referenceMobile, ['mobile', 'wheelRadius_m'], 0.001));
    expect(error).toEqual({
      path: 'mobile.wheelRadius_m',
      key: 'robotSpec.tooSmall',
      message: 'Debe ser mayor o igual que 0.005',
    });
    const [missing] = errorsOf(
      withValue(referenceMobile, ['mobile', 'lineSensors', 'count'], undefined),
    );
    expect(missing?.message).toBe('Campo obligatorio');
  });

  test('reports every problem at once', () => {
    const input = withValue(withValue(referenceMobile, ['name'], ''), ['kind'], 'humanoid');
    const keys = errorsOf(input).map((error) => `${error.path}:${error.key}`);
    expect(keys).toEqual(['name:robotSpec.tooSmall', 'kind:robotSpec.invalidValue']);
  });
});
