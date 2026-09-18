import type { ArmSpec } from '@trayectoria/robot-spec';
import { describe, expect, it } from 'vitest';

import { urdfError, validate } from './validate';

type Joint = ArmSpec['joints'][number];
type Link = ArmSpec['links'][number];

const ZERO_ORIGIN: Joint['origin'] = { xyz: [0, 0, 0], rpy: [0, 0, 0] };
const Z_AXIS: Joint['axis'] = [0, 0, 1];

function link(name: string): Link {
  return { name };
}

function revolute(name: string, parent: string, child: string, limits?: Joint['limits']): Joint {
  return {
    name,
    type: 'revolute',
    parent,
    child,
    origin: ZERO_ORIGIN,
    axis: Z_AXIS,
    ...(limits === undefined ? {} : { limits }),
  };
}

function codes(errors: readonly { code: string }[]): readonly string[] {
  return errors.map((error) => error.code);
}

describe('urdfError', () => {
  it('derives the i18n key from the code', () => {
    expect(urdfError('noRoot')).toEqual({ code: 'noRoot', key: 'urdf.noRoot' });
  });

  it('keeps the detail when one is given', () => {
    expect(urdfError('badLimits', 'joint1')).toEqual({
      code: 'badLimits',
      key: 'urdf.badLimits',
      detail: 'joint1',
    });
  });
});

describe('validate', () => {
  it('accepts a chain of links hanging from a single root', () => {
    const links = [link('base_link'), link('link1'), link('tool0')];
    const joints = [
      revolute('joint1', 'base_link', 'link1', { lower: -1, upper: 1 }),
      revolute('joint2', 'link1', 'tool0', { lower: -1, upper: 1 }),
    ];
    expect(validate(links, joints)).toEqual([]);
  });

  it('accepts a single link with no joints', () => {
    expect(validate([link('base_link')], [])).toEqual([]);
  });

  it('reports a parent or child that names no declared link', () => {
    const errors = validate([link('base_link')], [revolute('joint1', 'base_link', 'ghost')]);
    expect(codes(errors)).toEqual(['missingLink']);
    expect(errors[0]?.detail).toBe('ghost');
  });

  it('reports both sides of a joint when neither link exists', () => {
    const errors = validate([link('other')], [revolute('joint1', 'a', 'b')]);
    expect(codes(errors)).toEqual(['missingLink', 'missingLink']);
  });

  it('skips the topology check while references are broken', () => {
    const errors = validate([link('base_link')], [revolute('joint1', 'base_link', 'ghost')]);
    expect(codes(errors)).not.toContain('noRoot');
  });

  it('reports noRoot when every link is a child', () => {
    const links = [link('a'), link('b')];
    const joints = [revolute('j1', 'a', 'b'), revolute('j2', 'b', 'a')];
    expect(codes(validate(links, joints))).toEqual(['noRoot']);
  });

  it('reports multipleRoots and names the roots', () => {
    const links = [link('a'), link('b')];
    const errors = validate(links, []);
    expect(codes(errors)).toEqual(['multipleRoots']);
    expect(errors[0]?.detail).toBe('a, b');
  });

  it('reports a cycle that leaves links unreachable from the root', () => {
    const links = [link('base_link'), link('a'), link('b')];
    const joints = [revolute('j1', 'a', 'b'), revolute('j2', 'b', 'a')];
    const errors = validate(links, joints);
    expect(codes(errors)).toEqual(['cycle']);
    expect(errors[0]?.detail).toBe('base_link');
  });

  it('reports badLimits when lower is not below upper', () => {
    const links = [link('base_link'), link('link1')];
    const joints = [revolute('joint1', 'base_link', 'link1', { lower: 1, upper: -1 })];
    const errors = validate(links, joints);
    expect(codes(errors)).toEqual(['badLimits']);
    expect(errors[0]?.detail).toBe('joint1');
  });

  it('reports badLimits when lower equals upper', () => {
    const links = [link('base_link'), link('link1')];
    const joints = [revolute('joint1', 'base_link', 'link1', { lower: 0, upper: 0 })];
    expect(codes(validate(links, joints))).toEqual(['badLimits']);
  });

  it('does not bound the limits of fixed and continuous joints', () => {
    const links = [link('base_link'), link('link1'), link('link2')];
    const joints: Joint[] = [
      { ...revolute('j1', 'base_link', 'link1', { lower: 1, upper: -1 }), type: 'fixed' },
      { ...revolute('j2', 'link1', 'link2', { lower: 1, upper: -1 }), type: 'continuous' },
    ];
    expect(validate(links, joints)).toEqual([]);
  });

  it('accepts a bounded joint with no limits declared', () => {
    const links = [link('base_link'), link('link1')];
    expect(validate(links, [revolute('joint1', 'base_link', 'link1')])).toEqual([]);
  });
});
